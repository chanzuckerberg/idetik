#version 300 es

precision highp float;
uniform sampler2D AccumSampler;
uniform sampler2D RevealSampler;

in vec2 TexCoords;
layout (location = 0) out vec4 fragColor;

void main() {
    vec4 tex0 = texture(AccumSampler, TexCoords);
    vec4 tex1 = texture(RevealSampler, TexCoords);
    vec4 accum = vec4(tex0.rgb, tex1.r);
    float revealage = tex0.a;
    fragColor = clamp(vec4(accum.rgb / clamp(accum.a, 1e-4, 3e4), revealage), 0.0, 1.0);
}
