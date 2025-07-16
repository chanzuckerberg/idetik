#version 300 es

precision mediump float;

precision highp int;

layout (location = 0) out vec4 fragColor;

// SAMPLER_TYPE must be defined by the application using this shader.
uniform highp SAMPLER_TYPE texture0;

uniform highp usampler2D texture1;

#define MAX_COLORS 32u
uniform vec4 ColorCycle[MAX_COLORS];
uniform uint ColorCycleLength;

uniform float u_opacity;

in vec2 TexCoords;

uint castToUint(uint value) {
    return value;
}

uint castToUint(int value) {
    return uint(abs(value));
}

vec4 unpackRgba(uint packed) {
    uint r = (packed >> 24u) & 0xFFu;
    uint g = (packed >> 16u) & 0xFFu;
    uint b = (packed >> 8u) & 0xFFu;
    uint a = packed & 0xFFu;
    return vec4(0.0, 0.0, float(b), float(a)) / 255.0;
}

void main() {
    uint texel = castToUint(texture(texture0, TexCoords).r);
    uint numColors = uint(textureSize(texture1, 0).x);
    for (uint i = 0u; i < numColors; ++i) {
        uint key = texelFetch(texture1, ivec2(i, 0), 0).r;
        if (texel == key) {
            uint value = texelFetch(texture1, ivec2(i, 1), 0).r;
            vec4 color = unpackRgba(value);
            fragColor = vec4(color.rgb, u_opacity * color.a);
            return;
        }
    }
    uint index = (texel - 1u) % ColorCycleLength;
    vec4 color = ColorCycle[index];
    fragColor = vec4(color.rgb, u_opacity * color.a);
}