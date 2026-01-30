#version 300 es

precision highp float;
uniform sampler2D AccumSampler;
uniform sampler2D RevealSampler;

in vec2 TexCoords;
out vec4 fragColor;

void main() {
    vec4 tex0 = texture(AccumSampler, TexCoords);
    vec4 tex1 = texture(RevealSampler, TexCoords);
    fragColor = tex0 + tex1;
}
