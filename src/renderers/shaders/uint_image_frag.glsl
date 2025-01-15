#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

uniform mediump usampler2D texture0;
uniform vec3 offsetRST;
uniform vec3 scaleRST;

in vec2 TexCoords;

void main() {
    // TODO: normalization of the value should be controlled by variable
    // parameters (e.g. contrast limits).
    // https://github.com/chanzuckerberg/imaging-active-learning/issues/32
    vec2 texCoords = TexCoords * scaleRST.xy + offsetRST.xy;
    float value = float(texture(texture0, texCoords).r) / 256.0;
    fragColor = vec4(value, value, value, 1);
}
