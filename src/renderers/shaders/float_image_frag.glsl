#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

uniform mediump sampler2D texture0;

in vec2 TexCoords;

void main() {
    // The scaling factor gives the float32 CryoET example data some
    // contrast when rendered.
    // TODO: instead normalization of the value should be controlled by
    // variable parameters (e.g. contrast limits).
    // https://github.com/chanzuckerberg/imaging-active-learning/issues/32
    float value = 2e5 * texture(texture0, TexCoords).r;
    fragColor = vec4(value, value, value, 1);
}