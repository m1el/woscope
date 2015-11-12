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
try {
    try {
        audioCtx = new AudioContext();
    } catch(e) {
        audioCtx = new webkitAudioContext();
    }
} catch(e) {
    throw new Error('Web Audio API is not supported in this browser');
}

let swap = false;
let invert = false;
let audioData = null;
let quadIndex = null;
let vertexIndex = null;
let nSamples = 4096;
let scratchBuffer = new Float32Array(nSamples*4);
let doBloom = false;
let frameBuffer = null;
let lineTexture = null;
let blurTexture = null;
let blurTexture2 = null;
let outQuadArray = null;

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
    let canvas = config.canvas,
        gl = initGl(canvas),
        audio = config.audio,
        audioUrl = config.audioUrl || audio.currentSrc || audio.src,
        callback = config.callback || function () {};

    swap = config.swap;
    invert = config.invert;

    gl.lineShader = createShader(gl, shadersDict.vsLine, shadersDict.fsLine);
    gl.blurShader = createShader(gl, shadersDict.vsBlurTranspose, shadersDict.fsBlurTranspose);
    gl.outputShader = createShader(gl, shadersDict.vsOutput, shadersDict.fsOutput);
    gl.progressShader = createShader(gl, shadersDict.vsProgress, shadersDict.fsProgress);

    quadIndex = makeQuadIndex(gl);
    vertexIndex = makeVertexIndex(gl);
    outQuadArray = makeOutQuad(gl);

    {
        let tmp = makeFrameBuffer(gl, canvas.width, canvas.height);
        frameBuffer = tmp.frameBuffer;
        lineTexture = tmp.lineTexture;
        blurTexture = tmp.blurTexture;
        blurTexture2 = tmp.blurTexture2;
    }

    let loop = function() {
        draw(gl, canvas, audio);
        requestAnimationFrame(loop);
    };

    let progress = 0;

    let progressLoop = function() {
        if (progress >= 1) {
            return;
        }
        drawProgress(gl, canvas, progress);
        requestAnimationFrame(progressLoop);
    };
    progressLoop();

    axhr(audioUrl, function(buffer) {
        callback();

        audioData = prepareAudioData(gl, buffer);
        loop();

    }, function(e) {
        progress = e.total ? e.loaded / e.total : 1.0;
        console.log('progress: ' + e.loaded + ' / ' + e.total);
    });
}

function initGl(canvas) {
    let gl = canvas.getContext('webgl');
    if (!gl) {
        $('nogl').style.display = 'block';
        throw new Error('no gl :C');
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

function makeQuadIndex(gl) {
    let index = new Int16Array(nSamples*2);
    for (let i = index.length; i--; ) {
        index[i] = i;
    }
    let vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, index, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    return vbo;
}

function makeVertexIndex(gl) {
    let len = (nSamples-1)*2*3,
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

function makeOutQuad(gl) {
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

function makeFrameBuffer(gl, width, height) {
    let frameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    frameBuffer.width = 1024;
    frameBuffer.height = 1024;

    gl.renderBuffer = gl.createRenderbuffer();

    return {
        frameBuffer: frameBuffer,
        lineTexture: makeTargetTexture(gl, frameBuffer.width, frameBuffer.height),
        blurTexture: makeTargetTexture(gl, frameBuffer.width, frameBuffer.height),
        blurTexture2: makeTargetTexture(gl, frameBuffer.width, frameBuffer.height),
    };
}

function prepareAudioData(gl, buffer) {
    let left = buffer.getChannelData(0),
        right = buffer.getChannelData(1);

    if (swap) {
        let tmp = left;
        left = right;
        right = tmp;
    }

    let vbo = gl.createBuffer();
    return {
        vbo: vbo,
        left: left,
        right: right,
        sampleRate: buffer.sampleRate,
    };
}

function loadWaveAtPosition(gl, position) {
    position = Math.max(0, position - 1/120);
    position = Math.floor(position*audioData.sampleRate);
    let end = Math.min(audioData.left.length, position+nSamples) - 1,
        len = end - position;
    let subArr = scratchBuffer,
        left = audioData.left,
        right = audioData.right;
    for (let i = 0; i < len; i++) {
        let t = i*8,
            p = i+position;
        subArr[t]   = subArr[t+2] = subArr[t+4] = subArr[t+6] = left[p];
        subArr[t+1] = subArr[t+3] = subArr[t+5] = subArr[t+7] = right[p];
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, audioData.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, subArr, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

function $(id) { return document.getElementById(id); }

function supportsWebGl() {
    // from https://github.com/Modernizr/Modernizr/blob/master/feature-detects/webgl.js
    let canvas = document.createElement('canvas'),
        supports = 'probablySupportsContext' in canvas ? 'probablySupportsContext' : 'supportsContext';
    if (supports in canvas) {
        return canvas[supports]('webgl') || canvas[supports]('experimental-webgl');
    }
    return 'WebGLRenderingContext' in window;
}

function activateTargetTexture(gl, texture) {
    gl.bindRenderbuffer(gl.RENDERBUFFER, gl.renderBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, frameBuffer.width, frameBuffer.height);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, gl.renderBuffer);

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
}

function drawProgress(gl, canvas, progress) {
    let width = canvas.width,
        height = canvas.height;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(gl.progressShader);

    {
        let tmpPos = gl.getUniformLocation(gl.progressShader, 'uProgress');
        if (tmpPos && tmpPos !== -1) {
            gl.uniform1f(tmpPos, progress);
        }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, outQuadArray);

    let posAttr = -1;
    {
        posAttr = gl.getAttribLocation(gl.progressShader, 'aPos');
        if (posAttr > -1) {
            gl.enableVertexAttribArray(posAttr);
            gl.vertexAttribPointer(posAttr, 2, gl.SHORT, false, 8, 0);
        }
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (posAttr > -1) {
        gl.disableVertexAttribArray(posAttr);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.useProgram(null);
}

function draw(gl, canvas, audio) {
    loadWaveAtPosition(gl, audio.currentTime);

    let width = canvas.width,
        height = canvas.height;

    if (!doBloom) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, width, height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        drawLine(gl, gl.lineShader);
    } else {

        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
        activateTargetTexture(gl, lineTexture);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.viewport(0, 0, width, height);
        drawLine(gl, gl.lineShader);

        { // generate mipmap
            gl.bindTexture(gl.TEXTURE_2D, lineTexture);
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.bindTexture(gl.TEXTURE_2D, null);
        }

        // downscale
        activateTargetTexture(gl, blurTexture2);
        gl.viewport(0, 0, width/2, height/2);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        drawTexture(gl, lineTexture, width, gl.outputShader);

        // blur x
        activateTargetTexture(gl, blurTexture);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        drawTexture(gl, blurTexture2, width/2, gl.blurShader);

        // blur y
        activateTargetTexture(gl, blurTexture2);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        drawTexture(gl, blurTexture, width/2, gl.blurShader);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.viewport(0, 0, width, height);
        drawTexture(gl, lineTexture, width, gl.outputShader);
        drawTexture(gl, blurTexture2, width/2, gl.outputShader, 0.5);
    }
}

function drawLine(gl, shader) {
    gl.useProgram(shader);
    {
        let tmpPos = gl.getUniformLocation(shader, 'uInvert');
        if (tmpPos && tmpPos !== -1) {
            gl.uniform1f(tmpPos, (invert) ? -1 : 1);
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
        gl.bindBuffer(gl.ARRAY_BUFFER, quadIndex);
        let idxAttr = gl.getAttribLocation(shader, 'aIdx');
        if (idxAttr > -1) {
            gl.enableVertexAttribArray(idxAttr);
            gl.vertexAttribPointer(idxAttr, 1, gl.SHORT, false, 2, 0);
            attribs.push(idxAttr);
        }
    }

    {
        gl.bindBuffer(gl.ARRAY_BUFFER, audioData.vbo);
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

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexIndex);
    gl.drawElements(gl.TRIANGLES, (nSamples-1)*2, gl.UNSIGNED_SHORT, 0);

    gl.disable(gl.BLEND);

    for (let a of attribs) {
        gl.disableVertexAttribArray(a);
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.useProgram(null);
}

function drawTexture(gl, texture, size, shader, alpha) {
    alpha = alpha || 1;
    gl.useProgram(shader);

    let attribs = [];
    gl.bindBuffer(gl.ARRAY_BUFFER, outQuadArray);

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

    for (let a of attribs) {
        gl.disableVertexAttribArray(a);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.useProgram(null);
}
