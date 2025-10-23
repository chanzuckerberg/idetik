#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

// TODO (SKM): Support other texture data types
uniform mediump usampler3D abc;
//uniform float u_zslice;

in vec2 TexCoords;

void main() {
    //float texel = float(texture(ImageSampler, vec3(TexCoords, u_zSlice)).r);
    float accum = 0.0;
    for (int i = 0; i < 256; i++) {
        float z = float(i) / 255.0;
        float texel = float(texture(abc, vec3(TexCoords, z)).r);
        accum += texel;
    }
    //float texel = float(texture(abc, vec3(TexCoords, 0.5)).r);
    //float texel2 = float(texture(abc, vec3(TexCoords, 0.8)).r);
    float displayValue = accum / 100.0;
    //if (TexCoords.x > 0.5 && TexCoords.y > 0.5) {
        //fragColor = vec4(TexCoords.r, TexCoords.g, 0.0, 1.0);
    //}
    //else {
    //    fragColor = vec4(displayValue, displayValue, displayValue, 1.0);
    //}
    fragColor = vec4(displayValue, displayValue, displayValue, 1.0);
}
