var CreateShader = function(gl, vsSource, fsSource) {
    'use strict';
    if (typeof WebGLRenderingContext !== 'function' ||
            !(gl instanceof WebGLRenderingContext)) {
        throw new Error('CreateShader: no WebGL context');
    }

    let vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
        let infoLog = gl.getShaderInfoLog(vs);
        gl.deleteShader(vs);
        throw new Error('CreateShader, vertex shader compilation:\n' + infoLog);
    }

    let fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
        let infoLog = gl.getShaderInfoLog(fs);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        throw new Error('CreateShader, fragment shader compilation:\n' + infoLog);
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
        throw new Error('CreateShader, linking:\n' + infoLog);
    }

    return program;
};
