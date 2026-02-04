#version 300 es

precision highp float;
uniform sampler2D AccumSampler;
uniform sampler2D RevealSampler;

in vec2 TexCoords;
out vec4 fragColor;

void main() {
    vec4 accum = texture(AccumSampler, TexCoords);
    vec4 reveal = texture(RevealSampler, TexCoords);

    // Composite the OIT buffers
    fragColor = accum + reveal;
}
