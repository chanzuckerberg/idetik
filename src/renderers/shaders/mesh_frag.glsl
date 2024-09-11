#version 300 es

precision mediump float;
precision mediump usampler2D;

layout (location = 0) out vec4 fragColor;

uniform usampler2D texture0;
in vec2 TexCoords;

void main() {
    fragColor = vec4(float(texture(texture0, TexCoords).r), 0, 0, 1);
}