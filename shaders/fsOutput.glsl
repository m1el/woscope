precision highp float;
uniform sampler2D uTexture;
uniform float uAlpha;
varying vec2 vTexCoord;
void main (void) {
    vec4 color = texture2D(uTexture, vTexCoord);
    color.a = uAlpha;
    gl_FragColor = color;
}
