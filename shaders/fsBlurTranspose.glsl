precision highp float;
uniform sampler2D uTexture;
uniform float uSize;
varying vec2 vTexCoord;
void main (void) {
    float point = uSize/1024.0/1024.0*2.0;
    vec4 color = texture2D(uTexture, vTexCoord);
    float sum = 0.0;
    sum += texture2D(uTexture, vec2(vTexCoord.x - point*4.0, vTexCoord.y)).g * (1.0/25.0);
    sum += texture2D(uTexture, vec2(vTexCoord.x - point*3.0, vTexCoord.y)).g * (2.0/25.0);
    sum += texture2D(uTexture, vec2(vTexCoord.x - point*2.0, vTexCoord.y)).g * (3.0/25.0);
    sum += texture2D(uTexture, vec2(vTexCoord.x - point*1.0, vTexCoord.y)).g * (4.0/25.0);
    sum += texture2D(uTexture, vec2(vTexCoord.x            , vTexCoord.y)).g * (5.0/25.0);
    sum += texture2D(uTexture, vec2(vTexCoord.x + point*1.0, vTexCoord.y)).g * (4.0/25.0);
    sum += texture2D(uTexture, vec2(vTexCoord.x + point*2.0, vTexCoord.y)).g * (3.0/25.0);
    sum += texture2D(uTexture, vec2(vTexCoord.x + point*3.0, vTexCoord.y)).g * (2.0/25.0);
    sum += texture2D(uTexture, vec2(vTexCoord.x + point*4.0, vTexCoord.y)).g * (1.0/25.0);
    gl_FragColor = vec4(0.0, sum, 0.0, 1.0);
}
