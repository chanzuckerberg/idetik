#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

uniform mediump usampler2D texture0;
#define MAX_COLORS 32u
uniform vec4 ColorCycle[MAX_COLORS];
uniform uint ColorCycleLength;
uniform uint ColorOverridesKeys[MAX_COLORS];
uniform vec4 ColorOverridesValues[MAX_COLORS];
uniform uint ColorOverridesLength;

uniform float u_opacity;

in vec2 TexCoords;

void main() {
    uint texel = texture(texture0, TexCoords).r;
    for (uint i = 0u; i < ColorOverridesLength; ++i) {
        if (texel == ColorOverridesKeys[i]) {
            fragColor = vec4(ColorOverridesValues[i].rgb, u_opacity * ColorOverridesValues[i].a);
            return;
        }
    }
    uint index = (texel - 1u) % ColorCycleLength;
    vec4 color = ColorCycle[index];
    fragColor = vec4(color.rgb, u_opacity * color.a);
}