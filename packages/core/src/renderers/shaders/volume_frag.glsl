#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

// TODO (SKM): Support other texture data types
uniform mediump usampler2D ImageSampler;

in vec2 TexCoords;

void main() {
    float texel = float(texture(ImageSampler, TexCoords).r);
    float displayValue = texel / 100.0;
    if (TexCoords.x > 0.5 && TexCoords.y > 0.5) {
        fragColor = vec4(TexCoords.r, TexCoords.g, 0.0, 1.0);
    }
    else {
        fragColor = vec4(displayValue, displayValue, displayValue, 1.0);
    }
}
