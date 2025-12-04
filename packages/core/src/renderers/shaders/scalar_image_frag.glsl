#version 300 es
#pragma inject_defines

precision mediump float;

layout (location = 0) out vec4 fragColor;

#if defined TEXTURE_DATA_TYPE_INT
uniform mediump isampler2D ImageSampler;
#elif defined TEXTURE_DATA_TYPE_UINT
uniform mediump usampler2D ImageSampler;
#else
uniform mediump sampler2D ImageSampler;
#endif

uniform vec3 Color;
uniform float ValueOffset;
uniform float ValueScale;
uniform float u_opacity;

// Viewport clipping uniforms
uniform float EnableClipping;
uniform vec3 ClipMin;
uniform vec3 ClipMax;

in vec2 TexCoords;
in vec3 WorldPosition;

void main() {
    // Discard fragments outside clip bounds
    if (EnableClipping > 0.5) {
        if (WorldPosition.x < ClipMin.x || WorldPosition.x > ClipMax.x ||
            WorldPosition.y < ClipMin.y || WorldPosition.y > ClipMax.y ||
            WorldPosition.z < ClipMin.z || WorldPosition.z > ClipMax.z) {
            discard;
        }
    }

    float texel = float(texture(ImageSampler, TexCoords).r);
    float value = (texel + ValueOffset) * ValueScale;
    fragColor = vec4(value * Color, u_opacity);
}