#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

uniform float u_opacity;

void main() {
    fragColor = vec4(1.0, 1.0, 1.0, u_opacity);
}
