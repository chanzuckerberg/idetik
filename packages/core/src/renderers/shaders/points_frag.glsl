#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

uniform mediump sampler2DArray markerAtlas;

in vec4 color;
flat in uint marker;


void main() {
    float alpha = texture(markerAtlas, vec3(gl_PointCoord, marker)).r;
    float alpha_threshold = 1e-2;
    if (alpha < alpha_threshold) {
        discard;
    }
    fragColor = vec4(color.rgb, 1.0);
}

