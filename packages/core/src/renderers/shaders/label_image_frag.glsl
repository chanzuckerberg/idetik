#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

// SAMPLER_TYPE must be defined by the application using this shader.
uniform mediump SAMPLER_TYPE texture0;

#define MAX_COLORS 32u
uniform vec4 ColorCycle[MAX_COLORS];
uniform uint ColorCycleLength;
uniform uint ColorOverridesKeys[MAX_COLORS];
uniform vec4 ColorOverridesValues[MAX_COLORS];
uniform uint ColorOverridesLength;

uniform float u_opacity;

in vec2 TexCoords;

uint castToUint(uint value) {
    return value;
}

uint castToUint(int value) {
    return uint(abs(value));
}

void main() {
    uint texel = castToUint(texture(texture0, TexCoords).r);
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