#version 300 es

out vec2 TexCoords;

void main() {
    vec2 pos;
    if (gl_VertexID == 0) {
        pos = vec2(-1.0, -1.0);
    } else if (gl_VertexID == 1) {
        pos = vec2(3.0, -1.0);
    } else {
        pos = vec2(-1.0, 3.0);
    }
    TexCoords = pos * 0.5 + 0.5;
    gl_Position = vec4(pos, 0.0, 1.0);
}
