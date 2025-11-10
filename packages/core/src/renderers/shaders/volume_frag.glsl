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

in vec2 TexCoords;

void main() {
    float alpha = 0.0;
    /* Will replace fixed steps and normalization with uniforms later */
    for (int i = 0; i < 256; i++) {
        float z = float(i) / 255.0;
        float texel = float(texture(ImageSampler, vec3(TexCoords, z)).r);
        float newAlpha = clamp(texel / 1000.0, 0.0, 1.0);
        alpha = (1.0 - alpha) * newAlpha + alpha;
    }
    float displayValue = alpha;
    fragColor = vec4(displayValue, displayValue, displayValue, 1.0);
}
