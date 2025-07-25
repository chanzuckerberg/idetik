#version 300 es

precision mediump float;
precision highp int;

layout (location = 0) out vec4 fragColor;

uniform highp usampler2D ImageSampler;
uniform mediump sampler2D ColorCycleSampler;

uniform float u_opacity;

in vec2 TexCoords;

void main() {
    uint texel = texture(ImageSampler, TexCoords).r;
    if (texel == 0u) {
        fragColor = vec4(0.0, 0.0, 0.0, 0.0);
        return;
    }
    uint cycleLength = uint(textureSize(ColorCycleSampler, 0).x);
    uint index = uint(texel - 1u) % cycleLength;
    vec4 color = texelFetch(ColorCycleSampler, ivec2(index, 0), 0);
    fragColor = vec4(color.rgb, u_opacity * color.a);
}