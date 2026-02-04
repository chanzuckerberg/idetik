#version 300 es

precision highp float;
uniform sampler2D AccumSampler;
uniform sampler2D RevealSampler;
uniform sampler2D DepthSampler;

in vec2 TexCoords;
out vec4 fragColor;

void main() {
    vec4 tex0 = texture(AccumSampler, TexCoords);
    vec4 tex1 = texture(RevealSampler, TexCoords);

    // Sample depth value (0.0 = near, 1.0 = far)
    float depth = texture(DepthSampler, TexCoords).r;

    // Composite the color buffers
    vec4 color = tex0 + tex1;

    // Depth must contribute to output or GLSL compiler will optimize it apparently
    fragColor = color + vec4(0.0, 0.0, 0.0, depth * 0.00001);
}
