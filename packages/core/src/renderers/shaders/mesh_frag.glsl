#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

uniform sampler2D ImageData;

in vec2 TexCoords;

void main() {
    fragColor = vec4(texture(ImageData, TexCoords).rgb, 1.0);
}