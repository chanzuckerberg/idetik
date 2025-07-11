#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

uniform mediump usampler2D texture0;
#define MAX_COLORS 32u
uniform vec3 ColorCycle[MAX_COLORS];
uniform uint ColorCycleLength;

uniform float u_opacity;

in vec2 TexCoords;

void main() {
    uint texel = texture(texture0, TexCoords).r;
    if (texel == 0u) {
        fragColor = vec4(0.0, 0.0, 0.0, 0.0);
    } else {
        uint index = (texel - 1u) % ColorCycleLength;
        vec3 color = ColorCycle[index];
        fragColor = vec4(color, u_opacity);
    }
}