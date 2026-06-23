#version 300 es

layout (location = 0) in vec3 a_position;
layout (location = 1) in vec3 a_normal;
layout (location = 2) in vec2 a_uv;

uniform mat4 u_projection;
uniform mat4 u_modelView;

out vec2 v_texCoords;

void main() {
    v_texCoords = a_uv;
    gl_Position = u_projection * u_modelView * vec4(a_position, 1.0);
}