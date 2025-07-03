#version 300 es

// These must be defined by the application before compilation.
// #define SAMPLER_TYPE <samplerType> 

precision mediump float;

layout (location = 0) out vec4 fragColor;

uniform mediump SAMPLER_TYPE texture0;
// Define a maximum number of channels
#define MAX_CHANNELS 32
uniform bool Visible[MAX_CHANNELS];
uniform vec3 Color[MAX_CHANNELS];
uniform float ValueOffset[MAX_CHANNELS];
uniform float ValueScale[MAX_CHANNELS];
uniform float u_opacity;

in vec2 TexCoords;

void main() {
    vec3 rgbColor = vec3(0, 0, 0);
    for (int i = 0; i < MAX_CHANNELS; i++) {
        if (!Visible[i]) continue;
        float texel = float(texture(texture0, vec3(TexCoords, i)).r);
        float value = (texel + ValueOffset[i]) * ValueScale[i];
        // clamp to [0, 1] because contrast limits may put values out of this range,
        // which distorts colors in other channels
        value = clamp(value, 0.0, 1.0);
        rgbColor += value * Color[i];
    }
    fragColor = vec4(rgbColor, u_opacity);
}
