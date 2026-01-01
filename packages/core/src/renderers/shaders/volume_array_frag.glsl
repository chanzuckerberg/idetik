#version 300 es
#pragma inject_defines

precision highp float;

layout (location = 0) out vec4 fragColor;

void main() {
    // Step 1 - calculate where the ray enters and exits the volume
    fragColor = vec4(1.0, 0.0, 0.0, 1.0);
    return;
}
