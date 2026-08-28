#version 300 es

precision mediump float;

uniform mediump sampler2DArray u_markerAtlas;

flat in uint v_marker;

// Depth-only counterpart to points_frag.glsl. Point sprites are alpha tested
// against the marker atlas, so the test has to be repeated here or the whole
// square sprite would occlude.
void main() {
    if (texture(u_markerAtlas, vec3(gl_PointCoord, v_marker)).r < 1e-2) {
        discard;
    }
}
