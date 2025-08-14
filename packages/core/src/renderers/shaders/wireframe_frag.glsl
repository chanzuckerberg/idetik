#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

uniform float u_opacity;
uniform vec3 u_color;

void main() {
    fragColor = vec4(u_color, u_opacity);
}