#version 300 es

precision highp float;

in vec2 vTexCoord;
in vec2 vTexPos;

out vec4 fragColor;

uniform sampler2D bitmapTexture;

void main() {
    fragColor = texture(bitmapTexture, vTexCoord);
}