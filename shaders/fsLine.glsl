precision highp float;
#define EPS 1E-6
#define TAU 6.283185307179586
#define TAUR 2.5066282746310002
#define SQRT2 1.4142135623730951
uniform float uSize;
uniform float uIntensity;
uniform vec4 uColor;
varying vec4 uvl;
float gaussian(float x, float sigma) {
    return exp(-(x * x) / (2.0 * sigma * sigma)) / (TAUR * sigma);
}

float erf(float x) {
    float s = sign(x), a = abs(x);
    x = 1.0 + (0.278393 + (0.230389 + (0.000972 + 0.078108 * a) * a) * a) * a;
    x *= x;
    return s - s / (x * x);
}
void main (void)
{
    float len = uvl.z;
    vec2 xy = vec2((len/2.0+uSize)*uvl.x+len/2.0, uSize*uvl.y);
    float alpha;

    float sigma = uSize/4.0;
    if (len < EPS) {
    // If the beam segment is too short, just calculate intensity at the position.
        alpha = exp(-pow(length(xy),2.0)/(2.0*sigma*sigma))/2.0/sqrt(uSize);
    } else {
    // Otherwise, use analytical integral for accumulated intensity.
        alpha = erf((len-xy.x)/SQRT2/sigma) + erf(xy.x/SQRT2/sigma);
        alpha *= exp(-xy.y*xy.y/(2.0*sigma*sigma))/2.0/len*uSize;
    }
    float afterglow = smoothstep(0.0, 0.33, uvl.w/2048.0);
    alpha *= afterglow * uIntensity;
    gl_FragColor = vec4(vec3(uColor), uColor.a * alpha);
}
