#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

uniform sampler2D u_imageSampler;

in vec2 v_texCoords;

void main() {
    fragColor = vec4(texture(u_imageSampler, v_texCoords).rgb, 1.0);
}