precision highp float;
uniform float uProgress;
varying vec2 vUV;
float rect(vec2 p, vec2 s) {
    return max(abs(p.x)-s.x,abs(p.y)-s.y);
}
void main (void) {
    float p = clamp(uProgress, 0.0, 1.0);
    float hw = 300.0;
    vec2 size = vec2(800.0, 800.0);
    vec2 c = size / 2.0;
    vec2 uv = vUV*size - c;
    float result = min(rect(uv,vec2(hw+5.,25.)),-rect(uv,vec2(hw+10.,30.)));
    result = max(result,-rect(uv-vec2(hw*(p-1.0),0.0),vec2(hw*p, 20.0)));
    gl_FragColor = vec4(vec3(0.1, 1.0, 0.1) * clamp(result, 0.0, 1.0), 1.0);
}
