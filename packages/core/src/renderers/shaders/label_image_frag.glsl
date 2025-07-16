#version 300 es

precision mediump float;

precision highp int;

layout (location = 0) out vec4 fragColor;

// SAMPLER_TYPE must be defined by the application using this shader.
uniform highp SAMPLER_TYPE texture0;

uniform highp usampler2D texture1;
uniform highp usampler2D texture2;

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
    return vec4(r, g, float(b), float(a)) / 255.0;
}

void main() {
    // TODO: actually support signed integers...
    uint texel = castToUint(texture(texture0, TexCoords).r);

    // Check for color overrides
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
    
    // Otherwise, use the color cycle
    uint cycleLength = uint(textureSize(texture2, 0).x);
    uint index = (texel - 1u) % cycleLength;
    uint value = texelFetch(texture2, ivec2(index, 0), 0).r;
    vec4 color = unpackRgba(value);
    fragColor = vec4(color.rgb, u_opacity * color.a);
    // fragColor = vec4(1.0, 0.0, 0.0, u_opacity);
}