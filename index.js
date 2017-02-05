'use strict';

let glslify = require('glslify');

let shadersDict = {
    vsLine: glslify(__dirname + '/shaders/vsLine.glsl'),
    fsLine: glslify(__dirname + '/shaders/fsLine.glsl'),
    vsBlurTranspose: glslify(__dirname + '/shaders/vsBlurTranspose.glsl'),
    fsBlurTranspose: glslify(__dirname + '/shaders/fsBlurTranspose.glsl'),
    vsOutput: glslify(__dirname + '/shaders/vsOutput.glsl'),
    fsOutput: glslify(__dirname + '/shaders/fsOutput.glsl'),
    vsProgress: glslify(__dirname + '/shaders/vsProgress.glsl'),
    fsProgress: glslify(__dirname + '/shaders/fsProgress.glsl'),
};

let defaultColor = [1/32, 1, 1/32, 1],
    defaultBackground = [0, 0, 0, 1];

let audioCtx;

function axhr(url, callback, errorCallback, progress) {
    let request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'arraybuffer';
    request.onprogress = progress;
    request.onload = function() {
        if (request.status >= 400) {
            return errorCallback(`Error loading audio file - ${request.status} ${request.statusText}`);
        }
        audioCtx.decodeAudioData(request.response, function(buffer) {
            callback(buffer);
        }, function (e) {
            errorCallback('Unable to decode audio data');
        });
    };
    request.send();
}

module.exports = woscope;
function woscope(config) {
    audioCtx = audioCtx || initAudioCtx(config.error);

    let canvas = config.canvas,
        gl = initGl(canvas, config.background, config.error),
        audio = config.audio,
        audioUrl = config.audioUrl || audio.currentSrc || audio.src,
        live = (config.live === true) ? getLiveType() : config.live,
        callback = config.callback || function () {};

    let ctx = {
        gl: gl,
        destroy: destroy,
        live: live,
        swap: config.swap,
        invert: config.invert,
        sweep: config.sweep,
        color: config.color,
        color2: config.color2,
        lineShader: createShader(gl, shadersDict.vsLine, shadersDict.fsLine),
        blurShader: createShader(gl, shadersDict.vsBlurTranspose, shadersDict.fsBlurTranspose),
        outputShader: createShader(gl, shadersDict.vsOutput, shadersDict.fsOutput),
        progressShader: createShader(gl, shadersDict.vsProgress, shadersDict.fsProgress),
        progress: 0,
        loaded: false,
        nSamples: 4096,
        bloom: config.bloom,
    };

    Object.assign(ctx, {
        quadIndex: makeQuadIndex(ctx),
        vertexIndex: makeVertexIndex(ctx),
        outQuadArray: makeOutQuad(ctx),
        scratchBuffer: new Float32Array(ctx.nSamples*4),
        audioRamp: makeRamp(Math.ceil(ctx.nSamples / 3)),
    });

    Object.assign(ctx, makeFrameBuffer(ctx, canvas.width, canvas.height));

    function destroy() {
        // release GPU in Chrome
        let ext = gl.getExtension('WEBGL_lose_context');
        if (ext) {
            ext.loseContext();
        }
        // disconnect web audio nodes
        if (ctx.sourceNode) {
            ctx.sourceNode.disconnect();
            ctx.sourceNode.connect(audioCtx.destination);
        }
        // end loops, empty context object
        loop = emptyContext;
        progressLoop = emptyContext;
        function emptyContext() {
            Object.keys(ctx).forEach(function (val) { delete ctx[val]; });
        }
    }

    let loop = function() {
        draw(ctx, canvas, audio);
        requestAnimationFrame(loop);
    };

    if (ctx.live) {
        ctx.sourceNode = config.sourceNode || audioCtx.createMediaElementSource(audio);
        let source = gainWorkaround(ctx.sourceNode, audio);
        if (ctx.live === 'scriptProcessor') {
            ctx.scriptNode = initScriptNode(ctx, source);
        } else {
            ctx.analysers = initAnalysers(ctx, source);
        }
        callback(ctx);
        loop();
        return ctx;
    }

    let progressLoop = function() {
        if (ctx.loaded) {
            return;
        }
        drawProgress(ctx, canvas);
        requestAnimationFrame(progressLoop);
    };
    progressLoop();

    axhr(audioUrl, function(buffer) {
        ctx.audioData = prepareAudioData(ctx, buffer);
        ctx.loaded = true;
        callback(ctx);
        loop();
    },
    config.error,
    function (e) {
        ctx.progress = e.total ? e.loaded / e.total : 1.0;
        console.log('progress: ' + e.loaded + ' / ' + e.total);
    });

    return ctx;
}

function supportsAnalyserFloat() {
    return typeof audioCtx.createAnalyser().getFloatTimeDomainData === 'function';
}

function getLiveType() {
    return supportsAnalyserFloat() ? 'analyser' : 'scriptProcessor';
}

function initAudioCtx(errorCallback) {
    try {
        let AudioCtx = window.AudioContext || window.webkitAudioContext;
        return new AudioCtx();
    } catch(e) {
        let message = 'Web Audio API is not supported in this browser';
        if (errorCallback) {
            errorCallback(message);
        }
        throw new Error(message);
    }
}

function initGl(canvas, background, errorCallback) {
    let gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
        let message = 'WebGL is not supported in this browser :(';
        if (errorCallback) {
            errorCallback(message);
        }
        throw new Error(message);
    }
    gl.clearColor.apply(gl, background || defaultBackground);
    return gl;
}

function initAnalysers(ctx, sourceNode) {
    ctx.audioData = {
        sourceChannels: sourceNode.channelCount,
    };

    // Split the combined channels
    // Note: Chrome channelSplitter upmixes mono (out.L = in.M, out.R = in.M),
    // Firefox/Edge/Safari do not (out.L = in.M, out.R = 0) - as of Feb 2017
    let channelSplitter = audioCtx.createChannelSplitter(2);
    sourceNode.connect(channelSplitter);

    let analysers = [0, 1].map(function (val, index) {
        let analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        channelSplitter.connect(analyser, index, 0);
        return analyser;
    });

    let channelMerger = audioCtx.createChannelMerger(2);
    analysers.forEach(function(analyser, index) {
        analyser.connect(channelMerger, 0, index);
    });

    // connect the source directly to the destination to avoid mono inconsistency
    sourceNode.connect(audioCtx.destination);
    // Edge/Safari require analyser nodes to be connected to a destination
    muteOutput(channelMerger).connect(audioCtx.destination);

    return analysers;
}

function initScriptNode(ctx, sourceNode) {
    let samples = 1024;
    let scriptNode = audioCtx.createScriptProcessor(samples, 2, 2);
    sourceNode.connect(scriptNode);

    let audioData = [
        new Float32Array(ctx.nSamples),
        new Float32Array(ctx.nSamples),
    ];
    ctx.audioData = {
        left: audioData[0],
        right: audioData[1],
        sampleRate: audioCtx.sampleRate,
        sourceChannels: sourceNode.channelCount,
    };

    function processAudio(e) {
        let inputBuffer = e.inputBuffer,
            outputBuffer = e.outputBuffer;

        for (let i=0; i < inputBuffer.numberOfChannels; i++) {
            let inputData = inputBuffer.getChannelData(i),
                outputData = outputBuffer.getChannelData(i);

            // send unprocessed audio to output
            outputData.set(inputData);

            // append to audioData arrays
            let channel = audioData[i];
            // shift forward by x samples
            channel.set(channel.subarray(inputBuffer.length));
            // add new samples at end
            channel.set(inputData, channel.length - inputBuffer.length);
        }
    }

    scriptNode.onaudioprocess = processAudio;

    scriptNode.connect(audioCtx.destination);
    return scriptNode;
}

function gainWorkaround(node, audio) {
    // Safari: createMediaElementSource causes output to ignore volume slider,
    // so match gain to slider as a workaround
    let gainNode;
    if (audioCtx.constructor.name === 'webkitAudioContext') {
        gainNode = audioCtx.createGain();
        audio.onvolumechange = function () {
            gainNode.gain.value = (audio.muted) ? 0 : audio.volume;
        };
        node.connect(gainNode);
        return gainNode;
    } else {
        return node;
    }
}

function muteOutput(node) {
    let gainNode = audioCtx.createGain();
    gainNode.gain.value = 0;
    node.connect(gainNode);
    return gainNode;
}

function createShader(gl, vsSource, fsSource) {
    if (!supportsWebGl()) {
        throw new Error('createShader: no WebGL context');
    }

    let vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
        let infoLog = gl.getShaderInfoLog(vs);
        gl.deleteShader(vs);
        throw new Error('createShader, vertex shader compilation:\n' + infoLog);
    }

    let fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
        let infoLog = gl.getShaderInfoLog(fs);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        throw new Error('createShader, fragment shader compilation:\n' + infoLog);
    }

    let program = gl.createProgram();

    gl.attachShader(program, vs);
    gl.deleteShader(vs);

    gl.attachShader(program, fs);
    gl.deleteShader(fs);

    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        let infoLog = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error('createShader, linking:\n' + infoLog);
    }

    return program;
}

function makeQuadIndex(ctx) {
    let gl = ctx.gl;
    let index = new Int16Array(ctx.nSamples*2);
    for (let i = index.length; i--; ) {
        index[i] = i;
    }
    let vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, index, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    return vbo;
}

function makeVertexIndex(ctx) {
    let gl = ctx.gl;
    let len = (ctx.nSamples-1)*2*3,
        index = new Uint16Array(len);
    for (let i = 0, pos = 0; i < len; ) {
        index[i++] = pos;
        index[i++] = pos+2;
        index[i++] = pos+1;
        index[i++] = pos+1;
        index[i++] = pos+2;
        index[i++] = pos+3;
        pos += 4;
    }
    let vbo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    return vbo;
}

function makeOutQuad(ctx) {
    let gl = ctx.gl;
    let data = new Int16Array([
        -1, -1, 0, 0,
        -1,  1, 0, 1,
         1, -1, 1, 0,
         1,  1, 1, 1,
    ]);
    let vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    return vbo;
}

function makeTargetTexture(gl, width, height) {
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
}

function makeFrameBuffer(ctx, width, height) {
    let gl = ctx.gl;
    let frameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    frameBuffer.width = 1024;
    frameBuffer.height = 1024;


    return {
        renderBuffer: gl.createRenderbuffer(),
        frameBuffer: frameBuffer,
        lineTexture: makeTargetTexture(gl, frameBuffer.width, frameBuffer.height),
        blurTexture: makeTargetTexture(gl, frameBuffer.width, frameBuffer.height),
        blurTexture2: makeTargetTexture(gl, frameBuffer.width, frameBuffer.height),
        vbo: gl.createBuffer(),
        vbo2: gl.createBuffer(),
    };
}

function prepareAudioData(ctx, buffer) {
    let left = buffer.getChannelData(0),
        right = (buffer.numberOfChannels > 1) ? buffer.getChannelData(1) : left;

    return {
        left: left,
        right: right,
        sampleRate: buffer.sampleRate,
        sourceChannels: buffer.numberOfChannels,
    };
}

function makeRamp(len) {
    // returns array of "len" length, values linearly increase from -1 to 1
    let arr = new Float32Array(len),
        dx = 2 / (len - 1);
    for (let i = 0; i < len; i++) {
        arr[i] = (i * dx) - 1;
    }
    return arr;
}

function loadWaveAtPosition(ctx, position) {
    position = Math.max(0, position - 1/120);
    position = Math.floor(position*ctx.audioData.sampleRate);

    let end = Math.min(ctx.audioData.left.length, position+ctx.nSamples) - 1,
        len = end - position;
    let left = ctx.audioData.left.subarray(position, end),
        right = ctx.audioData.right.subarray(position, end);

    channelRouter(ctx, len, left, right);
}

function loadWaveLive(ctx) {
    let analyser0 = ctx.analysers[0],
        analyser1 = ctx.analysers[1];
    let len = analyser0.fftSize,
        left = new Float32Array(analyser0.fftSize),
        right = new Float32Array(analyser1.fftSize);

    analyser0.getFloatTimeDomainData(left);
    analyser1.getFloatTimeDomainData(right);

    channelRouter(ctx, len, left, right);
}

function channelRouter(ctx, len, left, right) {
    if (ctx.sweep && ctx.swap) {
        loadChannelsInto(ctx, len, ctx.vbo, ctx.audioRamp, right);
        loadChannelsInto(ctx, len, ctx.vbo2, ctx.audioRamp, left);
    } else if (ctx.sweep) {
        loadChannelsInto(ctx, len, ctx.vbo, ctx.audioRamp, left);
        loadChannelsInto(ctx, len, ctx.vbo2, ctx.audioRamp, right);
    } else if (ctx.swap) {
        loadChannelsInto(ctx, len, ctx.vbo, right, left);
    } else {
        loadChannelsInto(ctx, len, ctx.vbo, left, right);
    }
}

function loadChannelsInto(ctx, len, vbo, xAxis, yAxis) {
    let gl = ctx.gl,
        subArr = ctx.scratchBuffer;

    for (let i = 0; i < len; i++) {
        let t = i*8;
        subArr[t]   = subArr[t+2] = subArr[t+4] = subArr[t+6] = xAxis[i];
        subArr[t+1] = subArr[t+3] = subArr[t+5] = subArr[t+7] = yAxis[i];
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, subArr, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

function supportsWebGl() {
    // from https://github.com/Modernizr/Modernizr/blob/master/feature-detects/webgl.js
    let canvas = document.createElement('canvas'),
        supports = 'probablySupportsContext' in canvas ? 'probablySupportsContext' : 'supportsContext';
    if (supports in canvas) {
        return canvas[supports]('webgl') || canvas[supports]('experimental-webgl');
    }
    return 'WebGLRenderingContext' in window;
}

function activateTargetTexture(ctx, texture) {
    let gl = ctx.gl;
    gl.bindRenderbuffer(gl.RENDERBUFFER, ctx.renderBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, ctx.frameBuffer.width, ctx.frameBuffer.height);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, ctx.renderBuffer);

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
}

function drawProgress(ctx, canvas) {
    let progress = ctx.progress;
    let gl = ctx.gl;
    let width = canvas.width,
        height = canvas.height;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(ctx.progressShader);

    {
        let tmpPos = gl.getUniformLocation(ctx.progressShader, 'uProgress');
        if (tmpPos && tmpPos !== -1) {
            gl.uniform1f(tmpPos, progress);
        }
        tmpPos = gl.getUniformLocation(ctx.progressShader, 'uColor');
        if (tmpPos && tmpPos !== -1) {
            gl.uniform4fv(tmpPos, ctx.color || defaultColor);
        }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, ctx.outQuadArray);

    let attribs = [];
    {
        let tmpAttr = gl.getAttribLocation(ctx.progressShader, 'aPos');
        if (tmpAttr > -1) {
            gl.enableVertexAttribArray(tmpAttr);
            gl.vertexAttribPointer(tmpAttr, 2, gl.SHORT, false, 8, 0);
            attribs.push(tmpAttr);
        }

        tmpAttr = gl.getAttribLocation(ctx.progressShader, 'aUV');
        if (tmpAttr > -1) {
            gl.enableVertexAttribArray(tmpAttr);
            gl.vertexAttribPointer(tmpAttr, 2, gl.SHORT, false, 8, 4);
            attribs.push(tmpAttr);
        }
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    attribs.forEach(function(a){
        gl.disableVertexAttribArray(a);
    });

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.useProgram(null);
}

function draw(ctx, canvas, audio) {
    let gl = ctx.gl;
    if (ctx.live) {
        if (ctx.live === 'scriptProcessor') {
            loadWaveAtPosition(ctx, 0);
        } else {
            loadWaveLive(ctx);
        }
    } else {
        loadWaveAtPosition(ctx, audio.currentTime);
    }

    let width = canvas.width,
        height = canvas.height;

    if (!ctx.bloom) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, width, height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        drawLine(ctx, ctx.lineShader, ctx.vbo, ctx.color);
        if (ctx.sweep) {
            drawLine(ctx, ctx.lineShader, ctx.vbo2, ctx.color2);
        }
    } else {

        gl.bindFramebuffer(gl.FRAMEBUFFER, ctx.frameBuffer);
        activateTargetTexture(ctx, ctx.lineTexture);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.viewport(0, 0, width, height);
        drawLine(ctx, ctx.lineShader, ctx.vbo, ctx.color);
        if (ctx.sweep) {
            drawLine(ctx, ctx.lineShader, ctx.vbo2, ctx.color2);
        }

        { // generate mipmap
            gl.bindTexture(gl.TEXTURE_2D, ctx.lineTexture);
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.bindTexture(gl.TEXTURE_2D, null);
        }

        // downscale
        activateTargetTexture(ctx, ctx.blurTexture2);
        gl.viewport(0, 0, width/2, height/2);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        drawTexture(ctx, ctx.lineTexture, width, ctx.outputShader);

        // blur x
        activateTargetTexture(ctx, ctx.blurTexture);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        drawTexture(ctx, ctx.blurTexture2, width/2, ctx.blurShader);

        // blur y
        activateTargetTexture(ctx, ctx.blurTexture2);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        drawTexture(ctx, ctx.blurTexture, width/2, ctx.blurShader);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.viewport(0, 0, width, height);
        drawTexture(ctx, ctx.lineTexture, width, ctx.outputShader);
        drawTexture(ctx, ctx.blurTexture2, width/2, ctx.outputShader, 0.5);
    }
}

function drawLine(ctx, shader, vbo, color) {
    let gl = ctx.gl;
    gl.useProgram(shader);
    {
        let tmpPos = gl.getUniformLocation(shader, 'uInvert');
        if (tmpPos && tmpPos !== -1) {
            gl.uniform1f(tmpPos, (ctx.invert) ? -1 : 1);
        }
        tmpPos = gl.getUniformLocation(shader, 'uSize');
        if (tmpPos && tmpPos !== -1) {
            gl.uniform1f(tmpPos, 0.012);
        }
        tmpPos = gl.getUniformLocation(shader, 'uIntensity');
        if (tmpPos && tmpPos !== -1) {
            gl.uniform1f(tmpPos, 1);
        }
        tmpPos = gl.getUniformLocation(shader, 'uColor');
        if (tmpPos && tmpPos !== -1) {
            gl.uniform4fv(tmpPos, color || defaultColor);
        }
    }

    let attribs = [];

    {
        gl.bindBuffer(gl.ARRAY_BUFFER, ctx.quadIndex);
        let idxAttr = gl.getAttribLocation(shader, 'aIdx');
        if (idxAttr > -1) {
            gl.enableVertexAttribArray(idxAttr);
            gl.vertexAttribPointer(idxAttr, 1, gl.SHORT, false, 2, 0);
            attribs.push(idxAttr);
        }
    }

    {
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        let tmpPos = gl.getAttribLocation(shader, 'aStart');
        if (tmpPos > -1) {
            gl.enableVertexAttribArray(tmpPos);
            gl.vertexAttribPointer(tmpPos, 2, gl.FLOAT, false, 8, 0);
            attribs.push(tmpPos);
        }

        tmpPos = gl.getAttribLocation(shader, 'aEnd');
        if (tmpPos > -1) {
            gl.enableVertexAttribArray(tmpPos);
            gl.vertexAttribPointer(tmpPos, 2, gl.FLOAT, false, 8, 8*4);
            attribs.push(tmpPos);
        }
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ctx.vertexIndex);
    gl.drawElements(gl.TRIANGLES, (ctx.nSamples-1)*2, gl.UNSIGNED_SHORT, 0);

    gl.disable(gl.BLEND);

    attribs.forEach(function(a) {
        gl.disableVertexAttribArray(a);
    });

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.useProgram(null);
}

function drawTexture(ctx, texture, size, shader, alpha) {
    let gl = ctx.gl;
    alpha = alpha || 1;
    gl.useProgram(shader);

    let attribs = [];
    gl.bindBuffer(gl.ARRAY_BUFFER, ctx.outQuadArray);

    {
        let tmpPos = gl.getAttribLocation(shader, 'aPos');
        if (tmpPos > -1) {
            gl.enableVertexAttribArray(tmpPos);
            gl.vertexAttribPointer(tmpPos, 2, gl.SHORT, false, 8, 0);
            attribs.push(tmpPos);
        }

        tmpPos = gl.getAttribLocation(shader, 'aST');
        if (tmpPos > -1) {
            gl.enableVertexAttribArray(tmpPos);
            gl.vertexAttribPointer(tmpPos, 2, gl.SHORT, false, 8, 4);
            attribs.push(tmpPos);
        }
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    {
        let tmpPos = gl.getUniformLocation(shader, 'uTexture');
        if (tmpPos && tmpPos !== -1) {
            gl.uniform1i(tmpPos, 0);
        }
        tmpPos = gl.getUniformLocation(shader, 'uSize');
        if (tmpPos && tmpPos !== -1) {
            gl.uniform1f(tmpPos, size);
        }
        tmpPos = gl.getUniformLocation(shader, 'uAlpha');
        if (tmpPos && tmpPos !== -1) {
            gl.uniform1f(tmpPos, alpha);
        }
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    attribs.forEach(function(a) {
        gl.disableVertexAttribArray(a);
    });

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.useProgram(null);
}
