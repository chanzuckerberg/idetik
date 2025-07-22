#version 300 es

precision mediump float;
precision highp int;

layout (location = 0) out vec4 fragColor;

uniform highp usampler2D ImageData;
uniform highp usampler2D ColorCycle;

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
    uint texel = texture(ImageData, TexCoords).r;
    if (texel == 0u) {
        fragColor = vec4(0.0, 0.0, 0.0, 0.0);
        return;
    }
    uint cycleLength = uint(textureSize(ColorCycle, 0).x);
    uint index = uint(texel - 1u) % cycleLength;
    uint value = texelFetch(ColorCycle, ivec2(index, 0), 0).r;
    vec4 color = unpackRgba(value);
    fragColor = vec4(color.rgb, u_opacity * color.a);
}