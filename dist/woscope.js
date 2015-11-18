/**
 * @name    woscope
 * @version 0.1.0 | November 18th 2015
 * @author  m1el
 * @license MIT
 */
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.woscope = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var shadersDict = {
    vsLine: "#define GLSLIFY 1\nprecision highp float;\n#define EPS 1E-6\nuniform float uInvert;\nuniform float uSize;\nattribute vec2 aStart, aEnd;\nattribute float aIdx;\nvarying vec4 uvl;\nvarying float vLen;\nvoid main () {\n    float tang;\n    vec2 current;\n    // All points in quad contain the same data:\n    // segment start point and segment end point.\n    // We determine point position from it's index.\n    float idx = mod(aIdx,4.0);\n    if (idx >= 2.0) {\n        current = aEnd;\n        tang = 1.0;\n    } else {\n        current = aStart;\n        tang = -1.0;\n    }\n    float side = (mod(idx, 2.0)-0.5)*2.0;\n    uvl.xy = vec2(tang, side);\n    uvl.w = floor(aIdx / 4.0 + 0.5);\n\n    vec2 dir = aEnd-aStart;\n    uvl.z = length(dir);\n    if (uvl.z > EPS) {\n        dir = dir / uvl.z;\n    } else {\n    // If the segment is too short draw a square;\n        dir = vec2(1.0, 0.0);\n    }\n    vec2 norm = vec2(-dir.y, dir.x);\n    gl_Position = vec4((current+(tang*dir+norm*side)*uSize)*uInvert,0.0,1.0);\n    //gl_PointSize = 20.0;\n}\n",
    fsLine: "#define GLSLIFY 1\nprecision highp float;\n#define EPS 1E-6\n#define TAU 6.283185307179586\n#define TAUR 2.5066282746310002\n#define SQRT2 1.4142135623730951\nuniform float uSize;\nuniform float uIntensity;\nprecision highp float;\nvarying vec4 uvl;\nfloat gaussian(float x, float sigma) {\n    return exp(-(x * x) / (2.0 * sigma * sigma)) / (TAUR * sigma);\n}\n\nfloat erf(float x) {\n    float s = sign(x), a = abs(x);\n    x = 1.0 + (0.278393 + (0.230389 + (0.000972 + 0.078108 * a) * a) * a) * a;\n    x *= x;\n    return s - s / (x * x);\n}\nvoid main (void)\n{\n    float len = uvl.z;\n    vec2 xy = vec2((len/2.0+uSize)*uvl.x+len/2.0, uSize*uvl.y);\n    float alpha;\n\n    float sigma = uSize/4.0;\n    if (len < EPS) {\n    // If the beam segment is too short, just calculate intensity at the position.\n        alpha = exp(-pow(length(xy),2.0)/(2.0*sigma*sigma))/2.0/sqrt(uSize);\n    } else {\n    // Otherwise, use analytical integral for accumulated intensity.\n        alpha = erf((len-xy.x)/SQRT2/sigma) + erf(xy.x/SQRT2/sigma);\n        alpha *= exp(-xy.y*xy.y/(2.0*sigma*sigma))/2.0/len*uSize;\n    }\n    float afterglow = smoothstep(0.0, 0.33, uvl.w/2048.0);\n    alpha *= afterglow * uIntensity;\n    gl_FragColor = vec4(1./32., 1.0, 1./32., alpha);\n}\n",
    vsBlurTranspose: "#define GLSLIFY 1\nprecision highp float;\nuniform float uSize;\nattribute vec2 aPos, aST;\nvarying vec2 vTexCoord;\nvoid main (void) {\n    gl_Position = vec4(aPos.y, aPos.x, 1, 1);\n    vTexCoord = aST*uSize/1024.0;\n}\n",
    fsBlurTranspose: "#define GLSLIFY 1\nprecision highp float;\nuniform sampler2D uTexture;\nuniform float uSize;\nvarying vec2 vTexCoord;\nvoid main (void) {\n    float point = uSize/1024.0/1024.0*2.0;\n    vec4 color = texture2D(uTexture, vTexCoord);\n    float sum = 0.0;\n    sum += texture2D(uTexture, vec2(vTexCoord.x - point*4.0, vTexCoord.y)).g * (1.0/25.0);\n    sum += texture2D(uTexture, vec2(vTexCoord.x - point*3.0, vTexCoord.y)).g * (2.0/25.0);\n    sum += texture2D(uTexture, vec2(vTexCoord.x - point*2.0, vTexCoord.y)).g * (3.0/25.0);\n    sum += texture2D(uTexture, vec2(vTexCoord.x - point*1.0, vTexCoord.y)).g * (4.0/25.0);\n    sum += texture2D(uTexture, vec2(vTexCoord.x            , vTexCoord.y)).g * (5.0/25.0);\n    sum += texture2D(uTexture, vec2(vTexCoord.x + point*1.0, vTexCoord.y)).g * (4.0/25.0);\n    sum += texture2D(uTexture, vec2(vTexCoord.x + point*2.0, vTexCoord.y)).g * (3.0/25.0);\n    sum += texture2D(uTexture, vec2(vTexCoord.x + point*3.0, vTexCoord.y)).g * (2.0/25.0);\n    sum += texture2D(uTexture, vec2(vTexCoord.x + point*4.0, vTexCoord.y)).g * (1.0/25.0);\n    gl_FragColor = vec4(0.0, sum, 0.0, 1.0);\n}\n",
    vsOutput: "#define GLSLIFY 1\nprecision highp float;\nuniform float uSize;\nattribute vec2 aPos, aST;\nvarying vec2 vTexCoord;\nvoid main (void) {\n    gl_Position = vec4(aPos, 1, 1);\n    vTexCoord = aST*uSize/1024.0;\n}\n",
    fsOutput: "#define GLSLIFY 1\nprecision highp float;\nuniform sampler2D uTexture;\nuniform float uAlpha;\nvarying vec2 vTexCoord;\nvoid main (void) {\n    vec4 color = texture2D(uTexture, vTexCoord);\n    color.a = uAlpha;\n    gl_FragColor = color;\n}\n",
    vsProgress: "#define GLSLIFY 1\nprecision highp float;\nattribute vec2 aPos;\nattribute vec2 aUV;\nvarying vec2 vUV;\nvoid main (void) {\n    gl_Position = vec4(aPos, 1, 1);\n    vUV = aUV;\n}\n",
    fsProgress: "#define GLSLIFY 1\nprecision highp float;\nuniform float uProgress;\nvarying vec2 vUV;\nfloat rect(vec2 p, vec2 s) {\n    return max(abs(p.x)-s.x,abs(p.y)-s.y);\n}\nvoid main (void) {\n    float p = clamp(uProgress, 0.0, 1.0);\n    float hw = 300.0;\n    vec2 size = vec2(800.0, 800.0);\n    vec2 c = size / 2.0;\n    vec2 uv = vUV*size - c;\n    float result = min(rect(uv,vec2(hw+5.,25.)),-rect(uv,vec2(hw+10.,30.)));\n    result = max(result,-rect(uv-vec2(hw*(p-1.0),0.0),vec2(hw*p, 20.0)));\n    gl_FragColor = vec4(vec3(0.1, 1.0, 0.1) * clamp(result, 0.0, 1.0), 1.0);\n}\n"
};

var audioCtx = undefined;
try {
    try {
        audioCtx = new AudioContext();
    } catch (e) {
        audioCtx = new webkitAudioContext();
    }
} catch (e) {
    throw new Error('Web Audio API is not supported in this browser');
}

var swap = false;
var invert = false;
var audioData = null;
var quadIndex = null;
var vertexIndex = null;
var nSamples = 4096;
var scratchBuffer = new Float32Array(nSamples * 4);
var doBloom = false;
var frameBuffer = null;
var lineTexture = null;
var blurTexture = null;
var blurTexture2 = null;
var outQuadArray = null;

function axhr(url, callback, progress) {
    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'arraybuffer';
    request.onprogress = progress;
    request.onload = function () {
        audioCtx.decodeAudioData(request.response, function (buffer) {
            callback(buffer);
        });
    };
    request.send();
}

module.exports = woscope;
function woscope(config) {
    var canvas = config.canvas,
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
        var tmp = makeFrameBuffer(gl, canvas.width, canvas.height);
        frameBuffer = tmp.frameBuffer;
        lineTexture = tmp.lineTexture;
        blurTexture = tmp.blurTexture;
        blurTexture2 = tmp.blurTexture2;
    }

    var loop = function loop() {
        draw(gl, canvas, audio);
        requestAnimationFrame(loop);
    };

    var progress = 0;

    var progressLoop = function progressLoop() {
        if (progress >= 1) {
            return;
        }
        drawProgress(gl, canvas, progress);
        requestAnimationFrame(progressLoop);
    };
    progressLoop();

    axhr(audioUrl, function (buffer) {
        callback();

        audioData = prepareAudioData(gl, buffer);
        loop();
    }, function (e) {
        progress = e.total ? e.loaded / e.total : 1.0;
        console.log('progress: ' + e.loaded + ' / ' + e.total);
    });
}

function initGl(canvas) {
    var gl = canvas.getContext('webgl');
    if (!gl) {
        $('nogl').style.display = 'block';
        throw new Error('no gl :C');
    }
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    return gl;
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
        var infoLog = gl.getShaderInfoLog(fs);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        throw new Error('createShader, fragment shader compilation:\n' + infoLog);
    }

    var program = gl.createProgram();

    gl.attachShader(program, vs);
    gl.deleteShader(vs);

    gl.attachShader(program, fs);
    gl.deleteShader(fs);

    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        var infoLog = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error('createShader, linking:\n' + infoLog);
    }

    return program;
}

function makeQuadIndex(gl) {
    var index = new Int16Array(nSamples * 2);
    for (var i = index.length; i--;) {
        index[i] = i;
    }
    var vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, index, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    return vbo;
}

function makeVertexIndex(gl) {
    var len = (nSamples - 1) * 2 * 3,
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

function makeOutQuad(gl) {
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

function makeFrameBuffer(gl, width, height) {
    var frameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    frameBuffer.width = 1024;
    frameBuffer.height = 1024;

    gl.renderBuffer = gl.createRenderbuffer();

    return {
        frameBuffer: frameBuffer,
        lineTexture: makeTargetTexture(gl, frameBuffer.width, frameBuffer.height),
        blurTexture: makeTargetTexture(gl, frameBuffer.width, frameBuffer.height),
        blurTexture2: makeTargetTexture(gl, frameBuffer.width, frameBuffer.height)
    };
}

function prepareAudioData(gl, buffer) {
    var left = buffer.getChannelData(0),
        right = buffer.getChannelData(1);

    if (swap) {
        var tmp = left;
        left = right;
        right = tmp;
    }

    var vbo = gl.createBuffer();
    return {
        vbo: vbo,
        left: left,
        right: right,
        sampleRate: buffer.sampleRate
    };
}

function loadWaveAtPosition(gl, position) {
    position = Math.max(0, position - 1 / 120);
    position = Math.floor(position * audioData.sampleRate);
    var end = Math.min(audioData.left.length, position + nSamples) - 1,
        len = end - position;
    var subArr = scratchBuffer,
        left = audioData.left,
        right = audioData.right;
    for (var i = 0; i < len; i++) {
        var t = i * 8,
            p = i + position;
        subArr[t] = subArr[t + 2] = subArr[t + 4] = subArr[t + 6] = left[p];
        subArr[t + 1] = subArr[t + 3] = subArr[t + 5] = subArr[t + 7] = right[p];
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, audioData.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, subArr, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

function $(id) {
    return document.getElementById(id);
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

function activateTargetTexture(gl, texture) {
    gl.bindRenderbuffer(gl.RENDERBUFFER, gl.renderBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, frameBuffer.width, frameBuffer.height);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, gl.renderBuffer);

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
}

function drawProgress(gl, canvas, progress) {
    var width = canvas.width,
        height = canvas.height;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(gl.progressShader);

    {
        var tmpPos = gl.getUniformLocation(gl.progressShader, 'uProgress');
        if (tmpPos && tmpPos !== -1) {
            gl.uniform1f(tmpPos, progress);
        }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, outQuadArray);

    var attribs = [];
    {
        var tmpAttr = gl.getAttribLocation(gl.progressShader, 'aPos');
        if (tmpAttr > -1) {
            gl.enableVertexAttribArray(tmpAttr);
            gl.vertexAttribPointer(tmpAttr, 2, gl.SHORT, false, 8, 0);
            attribs.push(tmpAttr);
        }

        tmpAttr = gl.getAttribLocation(gl.progressShader, 'aUV');
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

function draw(gl, canvas, audio) {
    loadWaveAtPosition(gl, audio.currentTime);

    var width = canvas.width,
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

        {
            // generate mipmap
            gl.bindTexture(gl.TEXTURE_2D, lineTexture);
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.bindTexture(gl.TEXTURE_2D, null);
        }

        // downscale
        activateTargetTexture(gl, blurTexture2);
        gl.viewport(0, 0, width / 2, height / 2);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        drawTexture(gl, lineTexture, width, gl.outputShader);

        // blur x
        activateTargetTexture(gl, blurTexture);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        drawTexture(gl, blurTexture2, width / 2, gl.blurShader);

        // blur y
        activateTargetTexture(gl, blurTexture2);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        drawTexture(gl, blurTexture, width / 2, gl.blurShader);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.viewport(0, 0, width, height);
        drawTexture(gl, lineTexture, width, gl.outputShader);
        drawTexture(gl, blurTexture2, width / 2, gl.outputShader, 0.5);
    }
}

function drawLine(gl, shader) {
    gl.useProgram(shader);
    {
        var tmpPos = gl.getUniformLocation(shader, 'uInvert');
        if (tmpPos && tmpPos !== -1) {
            gl.uniform1f(tmpPos, invert ? -1 : 1);
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

    var attribs = [];

    {
        gl.bindBuffer(gl.ARRAY_BUFFER, quadIndex);
        var idxAttr = gl.getAttribLocation(shader, 'aIdx');
        if (idxAttr > -1) {
            gl.enableVertexAttribArray(idxAttr);
            gl.vertexAttribPointer(idxAttr, 1, gl.SHORT, false, 2, 0);
            attribs.push(idxAttr);
        }
    }

    {
        gl.bindBuffer(gl.ARRAY_BUFFER, audioData.vbo);
        var tmpPos = gl.getAttribLocation(shader, 'aStart');
        if (tmpPos > -1) {
            gl.enableVertexAttribArray(tmpPos);
            gl.vertexAttribPointer(tmpPos, 2, gl.FLOAT, false, 8, 0);
            attribs.push(tmpPos);
        }

        tmpPos = gl.getAttribLocation(shader, 'aEnd');
        if (tmpPos > -1) {
            gl.enableVertexAttribArray(tmpPos);
            gl.vertexAttribPointer(tmpPos, 2, gl.FLOAT, false, 8, 8 * 4);
            attribs.push(tmpPos);
        }
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexIndex);
    gl.drawElements(gl.TRIANGLES, (nSamples - 1) * 2, gl.UNSIGNED_SHORT, 0);

    gl.disable(gl.BLEND);

    attribs.forEach(function (a) {
        gl.disableVertexAttribArray(a);
    });

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.useProgram(null);
}

function drawTexture(gl, texture, size, shader, alpha) {
    alpha = alpha || 1;
    gl.useProgram(shader);

    var attribs = [];
    gl.bindBuffer(gl.ARRAY_BUFFER, outQuadArray);

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
        var tmpPos = gl.getUniformLocation(shader, 'uTexture');
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

    attribs.forEach(function (a) {
        gl.disableVertexAttribArray(a);
    });

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.useProgram(null);
}

},{}]},{},[1])(1)
});