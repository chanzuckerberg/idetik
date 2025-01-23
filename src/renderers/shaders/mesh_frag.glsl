#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

uniform sampler2D texture0;
// This will likely be [0, 1], in which case it has no effect.
// TODO: consider removing this to simplify and optimize this
// shader, and instead handle conditionally setting the uniform
// elsewhere.
uniform vec2 ContrastLimits;

in vec2 TexCoords;

void main() {
    float range = ContrastLimits.y - ContrastLimits.x;
    vec3 pixel = texture(texture0, TexCoords).rgb;
    fragColor = vec4((pixel - ContrastLimits.x) / range, 1.0);
}