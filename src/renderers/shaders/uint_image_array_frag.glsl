#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

uniform mediump usampler2DArray texture0;
uniform bool Visible[3];
uniform vec3 Color[3];
uniform float ValueOffset[3];
uniform float ValueScale[3];

in vec2 TexCoords;

void main() {
    vec3 rgbColor = vec3(0, 0, 0);
    for (int i = 0; i < 3; i++) {
        if (!Visible[i]) continue;
        float texel = float(texture(texture0, vec3(TexCoords, i)).r);
        float value = (texel + ValueOffset[i]) * ValueScale[i];
        rgbColor += value * Color[i].rgb;
    }
    fragColor = vec4(rgbColor.rgb, 1);
}