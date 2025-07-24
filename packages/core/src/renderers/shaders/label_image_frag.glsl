#version 300 es

precision mediump float;
precision highp int;

layout (location = 0) out vec4 fragColor;

uniform highp usampler2D ImageSampler;
uniform mediump sampler2D ColorCycleSampler;
uniform highp usampler2D ColorMapSampler;

uniform float u_opacity;

in vec2 TexCoords;

vec4 unpackRgba(uint packed) {
    uint r = (packed >> 24u) & 0xFFu;
    uint g = (packed >> 16u) & 0xFFu;
    uint b = (packed >> 8u) & 0xFFu;
    uint a = packed & 0xFFu;
    return vec4(float(r), float(g), float(b), float(a)) / 255.0;
}

void main() {
    uint texel = texture(ImageSampler, TexCoords).r;

    uint mapLength = uint(textureSize(ColorMapSampler, 0).x);
    for (uint i = 0u; i < mapLength; ++i) {
        uint key = texelFetch(ColorMapSampler, ivec2(i, 0), 0).r;
        if (texel == key) {
            uint value = texelFetch(ColorMapSampler, ivec2(i, 1), 0).r;
            vec4 color = unpackRgba(value);
            fragColor = vec4(color.rgb, u_opacity * color.a);
            return;
        }
    }

    uint cycleLength = uint(textureSize(ColorCycleSampler, 0).x);
    uint index = uint(texel - 1u) % cycleLength;
    vec4 color = texelFetch(ColorCycleSampler, ivec2(index, 0), 0);
    fragColor = vec4(color.rgb, u_opacity * color.a);
}