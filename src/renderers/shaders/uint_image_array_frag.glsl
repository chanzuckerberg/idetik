#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

uniform mediump usampler2DArray texture0;
uniform vec2 ContrastLimits;

in vec2 TexCoords;

void main() {
    float range = ContrastLimits.y - ContrastLimits.x;
    float red = (float(texture(texture0, vec3(TexCoords, 0)).r) - ContrastLimits.x) / range;
    float green = (float(texture(texture0, vec3(TexCoords, 1)).r) - ContrastLimits.x) / range;
    float blue = (float(texture(texture0, vec3(TexCoords, 2)).r) - ContrastLimits.x) / range;
    fragColor = vec4(red, green, blue, 1);
}