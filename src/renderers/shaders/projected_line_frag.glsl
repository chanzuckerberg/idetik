#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

uniform vec3 LineColor;
uniform float u_opacity;

void main() {
    fragColor = vec4(LineColor, u_opacity);
}
