#version 300 es

precision highp float;

layout (location = 0) in vec3 a_position;

uniform mat4 u_projection;
uniform mat4 u_modelView;
out highp vec3 v_positionModel;
out highp vec4 v_clipPosition;

void main() {
    v_positionModel = a_position;
    gl_Position = u_projection * u_modelView * vec4(a_position, 1.0);
    v_clipPosition = gl_Position;
}
