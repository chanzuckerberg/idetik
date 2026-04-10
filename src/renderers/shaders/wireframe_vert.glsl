#version 300 es

layout (location = 0) in vec3 inPosition;
layout (location = 1) in vec3 inNormal;

uniform mat4 Projection;
uniform mat4 ModelView;

void main() {
    gl_Position = Projection * ModelView * vec4(inPosition, 1.0);
}