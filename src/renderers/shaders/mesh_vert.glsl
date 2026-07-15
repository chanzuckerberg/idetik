#version 300 es

layout (location = 0) in vec3 a_position;
layout (location = 1) in vec3 a_normal;

uniform mat4 u_projection;
uniform mat4 u_modelView;
uniform mat4 u_model;

out vec3 v_positionWorld;

void main() {
    v_positionWorld = (u_model * vec4(a_position, 1.0)).xyz;
    gl_Position = u_projection * u_modelView * vec4(a_position, 1.0);
}
