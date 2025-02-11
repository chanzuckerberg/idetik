#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

uniform mediump sampler2DArray texture0;

in vec2 TexCoords;

void main() {
    float red = texture(texture0, vec3(TexCoords, 0)).r;
    float green = texture(texture0, vec3(TexCoords, 1)).r;
    float blue = texture(texture0, vec3(TexCoords, 2)).r;

    fragColor = vec4(red, green, blue, 1);
}
