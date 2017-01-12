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

let audioCtx;

function axhr(url, callback, progress) {
    let request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'arraybuffer';
    request.onprogress = progress;
    request.onload = function() {
        audioCtx.decodeAudioData(request.response, function(buffer) {
            callback(buffer);
        });
    };
    request.send();
}

module.exports = woscope;
function woscope(config) {
    audioCtx = audioCtx || initAudioCtx(config.error);

    let canvas = config.canvas,
        gl = initGl(canvas, config.error),
        audio = config.audio,
        audioUrl = config.audioUrl || audio.currentSrc || audio.src,
        callback = config.callback || function () {};

    let ctx = {
        gl: gl,
        swap: config.swap,
        invert: config.invert,
        lineShader: createShader(gl, shadersDict.vsLine, shadersDict.fsLine),
        blurShader: createShader(gl, shadersDict.vsBlurTranspose, shadersDict.fsBlurTranspose),
        outputShader: createShader(gl, shadersDict.vsOutput, shadersDict.fsOutput),
        progressShader: createShader(gl, shadersDict.vsProgress, shadersDict.fsProgress),
        progress: 0,
        loaded: false,
        nSamples: 4096,
        doBloom: false,
    };

    Object.assign(ctx, {
        quadIndex: makeQuadIndex(ctx),
        vertexIndex: makeVertexIndex(ctx),
        outQuadArray: makeOutQuad(ctx),
        scratchBuffer: new Float32Array(ctx.nSamples*4),
    });

    Object.assign(ctx, makeFrameBuffer(ctx, canvas.width, canvas.height));

    let loop = function() {
        draw(ctx, canvas, audio);
        requestAnimationFrame(loop);
    };

    let progressLoop = function() {
        if (ctx.loaded) {
            return;
        }
        drawProgress(ctx, canvas);
        requestAnimationFrame(progressLoop);
    };
    progressLoop();

    axhr(audioUrl, function(buffer) {
        callback();

        ctx.audioData = prepareAudioData(ctx, buffer);
        ctx.loaded = true;
        loop();

    }, function(e) {
        ctx.progress = e.total ? e.loaded / e.total : 1.0;
        console.log('progress: ' + e.loaded + ' / ' + e.total);
    });
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

function initGl(canvas, errorCallback) {
    let gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
        let message = 'WebGL is not supported in this browser :(';
        if (errorCallback) {
            errorCallback(message);
        }
        throw new Error(message);
    }
    gl.clearColor( 0.0, 0.0, 0.0, 1.0 );
    return gl;
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
    };
}

function prepareAudioData(ctx, buffer) {
    let left = buffer.getChannelData(0),
        right = buffer.getChannelData(1);

    if (ctx.swap) {
        let tmp = left;
        left = right;
        right = tmp;
    }

    return {
        left: left,
        right: right,
        sampleRate: buffer.sampleRate,
    };
}

function loadWaveAtPosition(ctx, position) {
    let gl = ctx.gl;
    position = Math.max(0, position - 1/120);
    position = Math.floor(position*ctx.audioData.sampleRate);

    let end = Math.min(ctx.audioData.left.length, position+ctx.nSamples) - 1,
        len = end - position;
    let subArr = ctx.scratchBuffer,
        left = ctx.audioData.left,
        right = ctx.audioData.right;
    for (let i = 0; i < len; i++) {
        let t = i*8,
            p = i+position;
        subArr[t]   = subArr[t+2] = subArr[t+4] = subArr[t+6] = left[p];
        subArr[t+1] = subArr[t+3] = subArr[t+5] = subArr[t+7] = right[p];
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, ctx.vbo);
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
    loadWaveAtPosition(ctx, audio.currentTime);

    let width = canvas.width,
        height = canvas.height;

    if (!ctx.doBloom) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, width, height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        drawLine(ctx, ctx.lineShader);
    } else {

        gl.bindFramebuffer(gl.FRAMEBUFFER, ctx.frameBuffer);
        activateTargetTexture(ctx, ctx.lineTexture);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.viewport(0, 0, width, height);
        drawLine(ctx, ctx.lineShader);

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

function drawLine(ctx, shader) {
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
        gl.bindBuffer(gl.ARRAY_BUFFER, ctx.vbo);
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
