precision highp float;
attribute vec2 aPos;
void main (void) {
    gl_Position = vec4(aPos, 1, 1);
}
