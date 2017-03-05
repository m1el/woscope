/**
 * @name    woscope
 * @version 0.2.2 | March 5th 2017
 * @author  m1el
 * @license MIT
 */
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.woscope = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var shadersDict = {
    vsLine: "precision highp float;\n#define GLSLIFY 1\n#define EPS 1E-6\nuniform float uInvert;\nuniform float uSize;\nattribute vec2 aStart, aEnd;\nattribute float aIdx;\nvarying vec4 uvl;\nvarying float vLen;\nvoid main () {\n    float tang;\n    vec2 current;\n    // All points in quad contain the same data:\n    // segment start point and segment end point.\n    // We determine point position from it's index.\n    float idx = mod(aIdx,4.0);\n    if (idx >= 2.0) {\n        current = aEnd;\n        tang = 1.0;\n    } else {\n        current = aStart;\n        tang = -1.0;\n    }\n    float side = (mod(idx, 2.0)-0.5)*2.0;\n    uvl.xy = vec2(tang, side);\n    uvl.w = floor(aIdx / 4.0 + 0.5);\n\n    vec2 dir = aEnd-aStart;\n    uvl.z = length(dir);\n    if (uvl.z > EPS) {\n        dir = dir / uvl.z;\n    } else {\n    // If the segment is too short draw a square;\n        dir = vec2(1.0, 0.0);\n    }\n    vec2 norm = vec2(-dir.y, dir.x);\n    gl_Position = vec4((current+(tang*dir+norm*side)*uSize)*uInvert,0.0,1.0);\n    //gl_PointSize = 20.0;\n}\n",
    fsLine: "precision highp float;\n#define GLSLIFY 1\n#define EPS 1E-6\n#define TAU 6.283185307179586\n#define TAUR 2.5066282746310002\n#define SQRT2 1.4142135623730951\nuniform float uSize;\nuniform float uIntensity;\nuniform vec4 uColor;\nvarying vec4 uvl;\nfloat gaussian(float x, float sigma) {\n    return exp(-(x * x) / (2.0 * sigma * sigma)) / (TAUR * sigma);\n}\n\nfloat erf(float x) {\n    float s = sign(x), a = abs(x);\n    x = 1.0 + (0.278393 + (0.230389 + (0.000972 + 0.078108 * a) * a) * a) * a;\n    x *= x;\n    return s - s / (x * x);\n}\nvoid main (void)\n{\n    float len = uvl.z;\n    vec2 xy = vec2((len/2.0+uSize)*uvl.x+len/2.0, uSize*uvl.y);\n    float alpha;\n\n    float sigma = uSize/4.0;\n    if (len < EPS) {\n    // If the beam segment is too short, just calculate intensity at the position.\n        alpha = exp(-pow(length(xy),2.0)/(2.0*sigma*sigma))/2.0/sqrt(uSize);\n    } else {\n    // Otherwise, use analytical integral for accumulated intensity.\n        alpha = erf((len-xy.x)/SQRT2/sigma) + erf(xy.x/SQRT2/sigma);\n        alpha *= exp(-xy.y*xy.y/(2.0*sigma*sigma))/2.0/len*uSize;\n    }\n    float afterglow = smoothstep(0.0, 0.33, uvl.w/2048.0);\n    alpha *= afterglow * uIntensity;\n    gl_FragColor = vec4(vec3(uColor), uColor.a * alpha);\n}\n",
    vsBlurTranspose: "precision highp float;\n#define GLSLIFY 1\nuniform float uSize;\nattribute vec2 aPos, aST;\nvarying vec2 vTexCoord;\nvoid main (void) {\n    gl_Position = vec4(aPos.y, aPos.x, 1, 1);\n    vTexCoord = aST*uSize/1024.0;\n}\n",
    fsBlurTranspose: "precision highp float;\n#define GLSLIFY 1\nuniform sampler2D uTexture;\nuniform float uSize;\nvarying vec2 vTexCoord;\nvoid main (void) {\n    float point = uSize/1024.0/1024.0*2.0;\n    vec4 color = texture2D(uTexture, vTexCoord);\n    float sum = 0.0;\n    sum += texture2D(uTexture, vec2(vTexCoord.x - point*4.0, vTexCoord.y)).g * (1.0/25.0);\n    sum += texture2D(uTexture, vec2(vTexCoord.x - point*3.0, vTexCoord.y)).g * (2.0/25.0);\n    sum += texture2D(uTexture, vec2(vTexCoord.x - point*2.0, vTexCoord.y)).g * (3.0/25.0);\n    sum += texture2D(uTexture, vec2(vTexCoord.x - point*1.0, vTexCoord.y)).g * (4.0/25.0);\n    sum += texture2D(uTexture, vec2(vTexCoord.x            , vTexCoord.y)).g * (5.0/25.0);\n    sum += texture2D(uTexture, vec2(vTexCoord.x + point*1.0, vTexCoord.y)).g * (4.0/25.0);\n    sum += texture2D(uTexture, vec2(vTexCoord.x + point*2.0, vTexCoord.y)).g * (3.0/25.0);\n    sum += texture2D(uTexture, vec2(vTexCoord.x + point*3.0, vTexCoord.y)).g * (2.0/25.0);\n    sum += texture2D(uTexture, vec2(vTexCoord.x + point*4.0, vTexCoord.y)).g * (1.0/25.0);\n    gl_FragColor = vec4(0.0, sum, 0.0, 1.0);\n}\n",
    vsOutput: "precision highp float;\n#define GLSLIFY 1\nuniform float uSize;\nattribute vec2 aPos, aST;\nvarying vec2 vTexCoord;\nvoid main (void) {\n    gl_Position = vec4(aPos, 1, 1);\n    vTexCoord = aST*uSize/1024.0;\n}\n",
    fsOutput: "precision highp float;\n#define GLSLIFY 1\nuniform sampler2D uTexture;\nuniform float uAlpha;\nvarying vec2 vTexCoord;\nvoid main (void) {\n    vec4 color = texture2D(uTexture, vTexCoord);\n    color.a = uAlpha;\n    gl_FragColor = color;\n}\n",
    vsProgress: "precision highp float;\n#define GLSLIFY 1\nattribute vec2 aPos;\nattribute vec2 aUV;\nvarying vec2 vUV;\nvoid main (void) {\n    gl_Position = vec4(aPos, 1, 1);\n    vUV = aUV;\n}\n",
    fsProgress: "precision highp float;\n#define GLSLIFY 1\nuniform float uProgress;\nuniform vec4 uColor;\nvarying vec2 vUV;\nfloat rect(vec2 p, vec2 s) {\n    return max(abs(p.x)-s.x,abs(p.y)-s.y);\n}\nvoid main (void) {\n    float p = clamp(uProgress, 0.0, 1.0);\n    float hw = 300.0;\n    vec2 size = vec2(800.0, 800.0);\n    vec2 c = size / 2.0;\n    vec2 uv = vUV*size - c;\n    float result = min(rect(uv,vec2(hw+5.,25.)),-rect(uv,vec2(hw+10.,30.)));\n    result = max(result,-rect(uv-vec2(hw*(p-1.0),0.0),vec2(hw*p, 20.0)));\n    gl_FragColor = uColor * clamp(result, 0.0, 1.0);\n}\n"
};

var defaultColor = [1 / 32, 1, 1 / 32, 1],
    defaultBackground = [0, 0, 0, 1];

var audioCtx = void 0;

function axhr(url, callback, errorCallback, progress) {
    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'arraybuffer';
    request.onprogress = progress;
    request.onload = function () {
        if (request.status >= 400) {
            return errorCallback("Error loading audio file - " + request.status + " " + request.statusText);
        }
        audioCtx.decodeAudioData(request.response, function (buffer) {
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

    var canvas = config.canvas,
        gl = initGl(canvas, config.background, config.error),
        audio = config.audio,
        audioUrl = config.audioUrl || audio.currentSrc || audio.src,
        live = config.live === true ? getLiveType() : config.live,
        callback = config.callback || function () {};

    var ctx = {
        gl: gl,
        destroy: destroy,
        live: live,
        swap: config.swap,
        invert: config.invert,
        sweep: config.sweep,
        color: config.color,
        color2: config.color2,
        lineSize: config.lineSize === undefined ? 0.012 : config.lineSize,
        lineShader: createShader(gl, shadersDict.vsLine, shadersDict.fsLine),
        blurShader: createShader(gl, shadersDict.vsBlurTranspose, shadersDict.fsBlurTranspose),
        outputShader: createShader(gl, shadersDict.vsOutput, shadersDict.fsOutput),
        progressShader: createShader(gl, shadersDict.vsProgress, shadersDict.fsProgress),
        progress: 0,
        loaded: false,
        nSamples: 2048,
        bloom: config.bloom
    };

    Object.assign(ctx, {
        quadIndex: makeQuadIndex(ctx),
        vertexIndex: makeVertexIndex(ctx),
        outQuadArray: makeOutQuad(ctx),
        scratchBuffer: new Float32Array(ctx.nSamples * 8),
        audioRamp: makeRamp(Math.ceil(ctx.nSamples / 3))
    });

    Object.assign(ctx, makeFrameBuffer(ctx, canvas.width, canvas.height));

    function destroy() {
        // release GPU in Chrome
        var ext = gl.getExtension('WEBGL_lose_context');
        if (ext) {
            ext.loseContext();
        }
        // disconnect web audio nodes
        if (ctx.sourceNode) {
            ctx.sourceNode.disconnect();
            ctx.sourceNode.connect(audioCtx.destination);
        }
        // end loops, empty context object
        _loop = emptyContext;
        _progressLoop = emptyContext;
        function emptyContext() {
            Object.keys(ctx).forEach(function (val) {
                delete ctx[val];
            });
        }
    }

    var _loop = function loop() {
        draw(ctx, canvas, audio);
        requestAnimationFrame(_loop);
    };

    if (ctx.live) {
        ctx.sourceNode = config.sourceNode || audioCtx.createMediaElementSource(audio);
        var source = gainWorkaround(ctx.sourceNode, audio);
        if (ctx.live === 'scriptProcessor') {
            ctx.scriptNode = initScriptNode(ctx, source);
        } else {
            ctx.analysers = initAnalysers(ctx, source);
        }
        callback(ctx);
        _loop();
        return ctx;
    }

    var _progressLoop = function progressLoop() {
        if (ctx.loaded) {
            return;
        }
        drawProgress(ctx, canvas);
        requestAnimationFrame(_progressLoop);
    };
    _progressLoop();

    axhr(audioUrl, function (buffer) {
        ctx.audioData = prepareAudioData(ctx, buffer);
        ctx.loaded = true;
        callback(ctx);
        _loop();
    }, config.error, function (e) {
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
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        return new AudioCtx();
    } catch (e) {
        var message = 'Web Audio API is not supported in this browser';
        if (errorCallback) {
            errorCallback(message);
        }
        throw new Error(message);
    }
}

function initGl(canvas, background, errorCallback) {
    var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
        var message = 'WebGL is not supported in this browser :(';
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
        sourceChannels: sourceNode.channelCount
    };

    // Split the combined channels
    // Note: Chrome channelSplitter upmixes mono (out.L = in.M, out.R = in.M),
    // Firefox/Edge/Safari do not (out.L = in.M, out.R = 0) - as of Feb 2017
    var channelSplitter = audioCtx.createChannelSplitter(2);
    sourceNode.connect(channelSplitter);

    var analysers = [0, 1].map(function (val, index) {
        var analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        channelSplitter.connect(analyser, index, 0);
        return analyser;
    });

    var channelMerger = audioCtx.createChannelMerger(2);
    analysers.forEach(function (analyser, index) {
        analyser.connect(channelMerger, 0, index);
    });

    // connect the source directly to the destination to avoid mono inconsistency
    sourceNode.connect(audioCtx.destination);
    // Edge/Safari require analyser nodes to be connected to a destination
    muteOutput(channelMerger).connect(audioCtx.destination);

    return analysers;
}

function initScriptNode(ctx, sourceNode) {
    var samples = 1024;
    var scriptNode = audioCtx.createScriptProcessor(samples, 2, 2);
    sourceNode.connect(scriptNode);

    var audioData = [new Float32Array(ctx.nSamples), new Float32Array(ctx.nSamples)];
    ctx.audioData = {
        left: audioData[0],
        right: audioData[1],
        sampleRate: audioCtx.sampleRate,
        sourceChannels: sourceNode.channelCount
    };

    function processAudio(e) {
        // scriptProcessor can distort output when resource-constrained,
        // so output silence instead by leaving the outputBuffer empty
        var inputBuffer = e.inputBuffer;

        for (var i = 0; i < inputBuffer.numberOfChannels; i++) {
            var inputData = inputBuffer.getChannelData(i);

            // append to audioData arrays
            var channel = audioData[i];
            // shift forward by x samples
            channel.set(channel.subarray(inputBuffer.length));
            // add new samples at end
            channel.set(inputData, channel.length - inputBuffer.length);
        }
    }

    scriptNode.onaudioprocess = processAudio;

    // connect the source directly to the destination to avoid distortion
    sourceNode.connect(audioCtx.destination);
    // Edge/Safari require scriptProcessor nodes to be connected to a destination
    scriptNode.connect(audioCtx.destination);

    return scriptNode;
}

function gainWorkaround(node, audio) {
    // Safari: createMediaElementSource causes output to ignore volume slider,
    // so match gain to slider as a workaround
    var gainNode = void 0;
    if (audioCtx.constructor.name === 'webkitAudioContext') {
        gainNode = audioCtx.createGain();
        audio.onvolumechange = function () {
            gainNode.gain.value = audio.muted ? 0 : audio.volume;
        };
        node.connect(gainNode);
        return gainNode;
    } else {
        return node;
    }
}

function muteOutput(node) {
    var gainNode = audioCtx.createGain();
    gainNode.gain.value = 0;
    node.connect(gainNode);
    return gainNode;
}

function createShader(gl, vsSource, fsSource) {
    if (!supportsWebGl()) {
        throw new Error('createShader: no WebGL context');
    }

    var vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
        var infoLog = gl.getShaderInfoLog(vs);
        gl.deleteShader(vs);
        throw new Error('createShader, vertex shader compilation:\n' + infoLog);
    }

    var fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
        var _infoLog = gl.getShaderInfoLog(fs);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        throw new Error('createShader, fragment shader compilation:\n' + _infoLog);
    }

    var program = gl.createProgram();

    gl.attachShader(program, vs);
    gl.deleteShader(vs);

    gl.attachShader(program, fs);
    gl.deleteShader(fs);

    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        var _infoLog2 = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error('createShader, linking:\n' + _infoLog2);
    }

    return program;
}

function makeQuadIndex(ctx) {
    var gl = ctx.gl;
    var index = new Int16Array(ctx.nSamples * 4);
    for (var i = index.length; i--;) {
        index[i] = i;
    }
    var vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, index, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    return vbo;
}

function makeVertexIndex(ctx) {
    var gl = ctx.gl;
    var len = (ctx.nSamples - 1) * 2 * 3,
        index = new Uint16Array(len);
    for (var i = 0, pos = 0; i < len;) {
        index[i++] = pos;
        index[i++] = pos + 2;
        index[i++] = pos + 1;
        index[i++] = pos + 1;
        index[i++] = pos + 2;
        index[i++] = pos + 3;
        pos += 4;
    }
    var vbo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    return vbo;
}

function makeOutQuad(ctx) {
    var gl = ctx.gl;
    var data = new Int16Array([-1, -1, 0, 0, -1, 1, 0, 1, 1, -1, 1, 0, 1, 1, 1, 1]);
    var vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    return vbo;
}

function makeTargetTexture(gl, width, height) {
    var texture = gl.createTexture();
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
    var gl = ctx.gl;
    var frameBuffer = gl.createFramebuffer();
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
        vbo2: gl.createBuffer()
    };
}

function prepareAudioData(ctx, buffer) {
    var left = buffer.getChannelData(0),
        right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;

    return {
        left: left,
        right: right,
        sampleRate: buffer.sampleRate,
        sourceChannels: buffer.numberOfChannels
    };
}

function makeRamp(len) {
    // returns array of "len" length, values linearly increase from -1 to 1
    var arr = new Float32Array(len),
        dx = 2 / (len - 1);
    for (var i = 0; i < len; i++) {
        arr[i] = i * dx - 1;
    }
    return arr;
}

function loadWaveAtPosition(ctx, position) {
    position = Math.max(0, position - 1 / 120);
    position = Math.floor(position * ctx.audioData.sampleRate);

    var end = Math.min(ctx.audioData.left.length, position + ctx.nSamples) - 1,
        len = end - position + 1;
    var left = ctx.audioData.left.subarray(position, end),
        right = ctx.audioData.right.subarray(position, end);

    channelRouter(ctx, len, left, right);
}

function loadWaveLive(ctx) {
    var analyser0 = ctx.analysers[0],
        analyser1 = ctx.analysers[1];
    var len = Math.min(ctx.nSamples, analyser0.fftSize),
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
    var gl = ctx.gl,
        subArr = ctx.scratchBuffer;

    for (var i = 0; i < len; i++) {
        var t = i * 8;
        subArr[t] = subArr[t + 2] = subArr[t + 4] = subArr[t + 6] = xAxis[i];
        subArr[t + 1] = subArr[t + 3] = subArr[t + 5] = subArr[t + 7] = yAxis[i];
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, subArr, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

function supportsWebGl() {
    // from https://github.com/Modernizr/Modernizr/blob/master/feature-detects/webgl.js
    var canvas = document.createElement('canvas'),
        supports = 'probablySupportsContext' in canvas ? 'probablySupportsContext' : 'supportsContext';
    if (supports in canvas) {
        return canvas[supports]('webgl') || canvas[supports]('experimental-webgl');
    }
    return 'WebGLRenderingContext' in window;
}

function activateTargetTexture(ctx, texture) {
    var gl = ctx.gl;
    gl.bindRenderbuffer(gl.RENDERBUFFER, ctx.renderBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, ctx.frameBuffer.width, ctx.frameBuffer.height);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, ctx.renderBuffer);

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
}

function drawProgress(ctx, canvas) {
    var progress = ctx.progress;
    var gl = ctx.gl;
    var width = canvas.width,
        height = canvas.height;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(ctx.progressShader);

    {
        var tmpPos = gl.getUniformLocation(ctx.progressShader, 'uProgress');
        if (tmpPos && tmpPos !== -1) {
            gl.uniform1f(tmpPos, progress);
        }
        tmpPos = gl.getUniformLocation(ctx.progressShader, 'uColor');
        if (tmpPos && tmpPos !== -1) {
            gl.uniform4fv(tmpPos, ctx.color || defaultColor);
        }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, ctx.outQuadArray);

    var attribs = [];
    {
        var tmpAttr = gl.getAttribLocation(ctx.progressShader, 'aPos');
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

    attribs.forEach(function (a) {
        gl.disableVertexAttribArray(a);
    });

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.useProgram(null);
}

function draw(ctx, canvas, audio) {
    var gl = ctx.gl;
    if (ctx.live) {
        if (ctx.live === 'scriptProcessor') {
            loadWaveAtPosition(ctx, 0);
        } else {
            loadWaveLive(ctx);
        }
    } else {
        loadWaveAtPosition(ctx, audio.currentTime);
    }

    var width = canvas.width,
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

        {
            // generate mipmap
            gl.bindTexture(gl.TEXTURE_2D, ctx.lineTexture);
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.bindTexture(gl.TEXTURE_2D, null);
        }

        // downscale
        activateTargetTexture(ctx, ctx.blurTexture2);
        gl.viewport(0, 0, width / 2, height / 2);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        drawTexture(ctx, ctx.lineTexture, width, ctx.outputShader);

        // blur x
        activateTargetTexture(ctx, ctx.blurTexture);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        drawTexture(ctx, ctx.blurTexture2, width / 2, ctx.blurShader);

        // blur y
        activateTargetTexture(ctx, ctx.blurTexture2);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        drawTexture(ctx, ctx.blurTexture, width / 2, ctx.blurShader);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.viewport(0, 0, width, height);
        drawTexture(ctx, ctx.lineTexture, width, ctx.outputShader);
        drawTexture(ctx, ctx.blurTexture2, width / 2, ctx.outputShader, 0.5);
    }
}

function drawLine(ctx, shader, vbo, color) {
    var gl = ctx.gl;
    gl.useProgram(shader);
    {
        var tmpPos = gl.getUniformLocation(shader, 'uInvert');
        if (tmpPos && tmpPos !== -1) {
            gl.uniform1f(tmpPos, ctx.invert ? -1 : 1);
        }
        tmpPos = gl.getUniformLocation(shader, 'uSize');
        if (tmpPos && tmpPos !== -1) {
            gl.uniform1f(tmpPos, ctx.lineSize);
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

    var attribs = [];

    {
        gl.bindBuffer(gl.ARRAY_BUFFER, ctx.quadIndex);
        var idxAttr = gl.getAttribLocation(shader, 'aIdx');
        if (idxAttr > -1) {
            gl.enableVertexAttribArray(idxAttr);
            gl.vertexAttribPointer(idxAttr, 1, gl.SHORT, false, 2, 0);
            attribs.push(idxAttr);
        }
    }

    {
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        var _tmpPos = gl.getAttribLocation(shader, 'aStart');
        if (_tmpPos > -1) {
            gl.enableVertexAttribArray(_tmpPos);
            gl.vertexAttribPointer(_tmpPos, 2, gl.FLOAT, false, 8, 0);
            attribs.push(_tmpPos);
        }

        _tmpPos = gl.getAttribLocation(shader, 'aEnd');
        if (_tmpPos > -1) {
            gl.enableVertexAttribArray(_tmpPos);
            gl.vertexAttribPointer(_tmpPos, 2, gl.FLOAT, false, 8, 8 * 4);
            attribs.push(_tmpPos);
        }
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ctx.vertexIndex);
    gl.drawElements(gl.TRIANGLES, (ctx.nSamples - 1) * 2 * 3, gl.UNSIGNED_SHORT, 0);

    gl.disable(gl.BLEND);

    attribs.forEach(function (a) {
        gl.disableVertexAttribArray(a);
    });

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.useProgram(null);
}

function drawTexture(ctx, texture, size, shader, alpha) {
    var gl = ctx.gl;
    alpha = alpha || 1;
    gl.useProgram(shader);

    var attribs = [];
    gl.bindBuffer(gl.ARRAY_BUFFER, ctx.outQuadArray);

    {
        var tmpPos = gl.getAttribLocation(shader, 'aPos');
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
        var _tmpPos2 = gl.getUniformLocation(shader, 'uTexture');
        if (_tmpPos2 && _tmpPos2 !== -1) {
            gl.uniform1i(_tmpPos2, 0);
        }
        _tmpPos2 = gl.getUniformLocation(shader, 'uSize');
        if (_tmpPos2 && _tmpPos2 !== -1) {
            gl.uniform1f(_tmpPos2, size);
        }
        _tmpPos2 = gl.getUniformLocation(shader, 'uAlpha');
        if (_tmpPos2 && _tmpPos2 !== -1) {
            gl.uniform1f(_tmpPos2, alpha);
        }
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    attribs.forEach(function (a) {
        gl.disableVertexAttribArray(a);
    });

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.useProgram(null);
}

},{}]},{},[1])(1)
});