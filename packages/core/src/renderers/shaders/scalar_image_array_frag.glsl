#version 300 es
#pragma inject_defines

precision mediump float;

layout (location = 0) out vec4 fragColor;

#if defined TEXTURE_DATA_TYPE_INT
uniform mediump isampler2DArray ImageSampler;
#elif defined TEXTURE_DATA_TYPE_UINT
uniform mediump usampler2DArray ImageSampler;
#else
uniform mediump sampler2DArray ImageSampler;
#endif
// Define a maximum number of channels
#define MAX_CHANNELS 32
uniform uint ChannelCount;
uniform bool Visible[MAX_CHANNELS];
uniform vec3 Color[MAX_CHANNELS];
uniform float ValueOffset[MAX_CHANNELS];
uniform float ValueScale[MAX_CHANNELS];
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

    vec3 rgbColor = vec3(0, 0, 0);
    for (uint i = 0u; i < ChannelCount; i++) {
        if (!Visible[i]) continue;
        float texel = float(texture(ImageSampler, vec3(TexCoords, i)).r);
        float value = (texel + ValueOffset[i]) * ValueScale[i];
        // clamp to [0, 1] because contrast limits may put values out of this range,
        // which distorts colors in other channels
        value = clamp(value, 0.0, 1.0);
        rgbColor += value * Color[i];
    }
    fragColor = vec4(rgbColor, u_opacity);
}
