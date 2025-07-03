#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

// SAMPLER_TYPE must be defined by the application using this shader.
uniform mediump SAMPLER_TYPE texture0;

uniform vec3 Color;
uniform float ValueOffset;
uniform float ValueScale;
uniform float u_opacity;

in vec2 TexCoords;

void main() {
    float texel = float(texture(texture0, TexCoords).r);
    float value = (texel + ValueOffset) * ValueScale;
    fragColor = vec4(value * Color, u_opacity);
}