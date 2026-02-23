#version 300 es

precision highp float;
uniform sampler2D Sampler0;
uniform sampler2D Sampler1;

in vec2 TexCoords;
layout (location = 0) out vec4 fragColor;

void main() {
    vec4 tex0 = texture(Sampler0, TexCoords);
    vec4 tex1 = texture(Sampler1, TexCoords);
    vec4 accum = vec4(tex0.rgb, tex1.r);
    float revealage = tex0.a;
    fragColor = vec4(accum.rgb / clamp(accum.a, 1e-4, 5e4), revealage);
}
