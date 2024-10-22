#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

uniform mediump usampler2DArray texture0;

in vec2 TexCoords;

void main() {
    float red = float(texture(texture0, vec3(TexCoords, 0)).r) / 256.0;
    float green = float(texture(texture0, vec3(TexCoords, 1)).r) / 256.0;
    float blue = float(texture(texture0, vec3(TexCoords, 2)).r) / 256.0;

    fragColor = vec4(red, green, blue, 1);
}