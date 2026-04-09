#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

uniform sampler2D ImageSampler;

in vec2 TexCoords;

void main() {
    fragColor = vec4(texture(ImageSampler, TexCoords).rgb, 1.0);
}