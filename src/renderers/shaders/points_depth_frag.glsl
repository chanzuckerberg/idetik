#version 300 es

precision mediump float;

uniform mediump sampler2DArray u_markerAtlas;

flat in uint v_marker;

void main() {
    if (texture(u_markerAtlas, vec3(gl_PointCoord, v_marker)).r < 1e-2) {
        discard;
    }
}
