#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

uniform vec2 Resolution;
uniform float Time;

void main() {
    vec2 uv = gl_FragCoord.xy / Resolution.xy;
    vec3 col = 0.5 + 0.5 * cos(Time + uv.xyx + vec3(0, 2, 4));

    fragColor = vec4(col,1.0);
}