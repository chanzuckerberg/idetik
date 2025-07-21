#version 300 es
#pragma inject_defines

precision mediump float;

layout (location = 0) out vec4 fragColor;

#if defined TEXTURE_DATA_TYPE_INT
uniform mediump isampler2D ImageData;
#elif defined TEXTURE_DATA_TYPE_UINT
uniform mediump usampler2D ImageData;
#else
uniform mediump sampler2D ImageData;
#endif

uniform vec3 Color;
uniform float ValueOffset;
uniform float ValueScale;
uniform float u_opacity;

in vec2 TexCoords;

void main() {
    float texel = float(texture(ImageData, TexCoords).r);
    float value = (texel + ValueOffset) * ValueScale;
    fragColor = vec4(value * Color, u_opacity);
}