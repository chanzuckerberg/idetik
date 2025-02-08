#version 300 es

precision mediump float;

layout(location = 0) out vec4 fragColor;

uniform mediump usampler2DArray texture0;
uniform bool channelEnabled[3];  // RGB toggle states

in vec2 TexCoords;

void main() {
    vec3 color = vec3(0.0);  // Start with black

    // Each enabled channel will add its color component
    if (channelEnabled[0]) {
        color.r = float(texture(texture0, vec3(TexCoords, 0)).r) / 256.0;
    }
    if (channelEnabled[1]) {
        color.g = float(texture(texture0, vec3(TexCoords, 1)).r) / 256.0;
    }
    if (channelEnabled[2]) {
        color.b = float(texture(texture0, vec3(TexCoords, 2)).r) / 256.0;
    }

    fragColor = vec4(color, 1.0);
}