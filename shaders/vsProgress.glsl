precision highp float;
attribute vec2 aPos;
attribute vec2 aUV;
varying vec2 vUV;
void main (void) {
    gl_Position = vec4(aPos, 1, 1);
    vUV = aUV;
}
