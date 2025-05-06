#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

uniform mediump sampler2DArray markerAtlas;

in vec4 color;
flat in uint marker;


void main() {
    float alpha = texture(markerAtlas, vec3(gl_PointCoord, marker)).r;
    if (alpha < 1e-3) {
        discard;
    }
    fragColor = vec4(color.rgb, 1.0);
}

