#version 300 es

precision mediump float;
precision mediump usampler2D;

layout (location = 0) out vec4 fragColor;

uniform usampler2D texture0;

in vec2 TexCoords;

void main() {
    // TODO: normalization of the value should be controlled by variable
    // parameters (e.g. contrast limits).
    // https://github.com/chanzuckerberg/imaging-active-learning/issues/32
    float value = float(texture(texture0, TexCoords).r) / 256.0;
    fragColor = vec4(value, value, value, 1);
}