#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

uniform mediump usampler2D texture0;
#define MAX_COLORS 6u
const vec3 Colors[MAX_COLORS] = vec3[MAX_COLORS](
vec3( 1.0, 0.5, 0.5 ),
vec3( 0.5, 1.0, 0.5 ),
vec3( 0.5, 0.5, 1.0 ),
vec3( 0.5, 1.0, 1.0 ),
vec3( 1.0, 0.5, 1.0 ),
vec3( 1.0, 1.0, 0.5 )
);

uniform float u_opacity;

in vec2 TexCoords;

void main() {
    uint texel = uint(texture(texture0, vec3(TexCoords, 0)));
    if (texel == 0u) {
        fragColor = vec4(0.0, 0.0, 0.0, 0.0);
    } else {
        vec3 color = Colors[(texel - 1u) % MAX_COLORS];
        fragColor = vec4(color, u_opacity);
    }
}