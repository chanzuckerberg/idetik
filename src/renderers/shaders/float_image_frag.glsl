#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

uniform mediump sampler2D texture0;
uniform vec2 ContrastLimits;

in vec2 TexCoords;

void main() {
    float texel = texture(texture0, TexCoords).r;
    float range = ContrastLimits.y - ContrastLimits.x;
    float value = (texel - ContrastLimits.x) / range;
    fragColor = vec4(value, value, value, 1);
}