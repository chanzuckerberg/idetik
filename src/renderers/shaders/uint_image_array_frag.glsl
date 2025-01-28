#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

uniform mediump usampler2DArray texture0;
uniform vec2 ContrastLimits[3];

in vec2 TexCoords;

void main() {
    fragColor = vec4(0, 0, 0, 1);
    for (int i = 0; i < 3; i++) {
        float range = ContrastLimits[i].y - ContrastLimits[i].x;
        float texel = float(texture(texture0, vec3(TexCoords, i)).r);
        vec4 color = vec4(0, 0, 0, 1);
        color[i] = (texel - ContrastLimits[i].x) / range;
        fragColor += color;
    }
}