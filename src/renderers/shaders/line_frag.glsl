#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

uniform vec3 LineColor;

in float distanceFromCenter;

void main() {
    float alpha = pow(abs(distanceFromCenter), 20.0);
    fragColor = vec4(LineColor, 1.0);
}
