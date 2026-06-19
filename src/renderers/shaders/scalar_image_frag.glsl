#version 300 es
#pragma inject_defines

precision mediump float;

layout (location = 0) out vec4 fragColor;

#if defined TEXTURE_DATA_TYPE_INT
uniform mediump isampler3D ImageSampler;
#elif defined TEXTURE_DATA_TYPE_UINT
uniform mediump usampler3D ImageSampler;
#else
uniform mediump sampler3D ImageSampler;
#endif

uniform vec3 Color;
uniform float ValueOffset;
uniform float ValueScale;
uniform float u_opacity;
uniform float ZTexCoord;

in vec2 TexCoords;

void main() {
    float texel = float(texture(ImageSampler, vec3(TexCoords, ZTexCoord)).r);
    float value = (texel + ValueOffset) * ValueScale;
    fragColor = vec4(value * Color, u_opacity);
}