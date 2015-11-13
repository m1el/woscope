precision highp float;
uniform float uSize;
attribute vec2 aPos, aST;
varying vec2 vTexCoord;
void main (void) {
    gl_Position = vec4(aPos, 1, 1);
    vTexCoord = aST*uSize/1024.0;
}
