#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

uniform mediump sampler2D texture0;
uniform float ValueOffset;
uniform float ValueScale;

in vec2 TexCoords;

void main() {
    float texel = texture(texture0, TexCoords).r;
    float value = (texel + ValueOffset) * ValueScale;
    fragColor = vec4(value, value, value, 1);
}