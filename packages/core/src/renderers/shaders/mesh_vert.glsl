#version 300 es

layout (location = 0) in vec3 inPosition;
layout (location = 1) in vec3 inNormal;
layout (location = 2) in vec2 inUV;

uniform mat4 Projection;
uniform mat4 ModelView;
uniform mat4 Model;

out vec2 TexCoords;
out vec3 WorldPosition;

void main() {
    TexCoords = inUV;
    WorldPosition = (Model * vec4(inPosition, 1.0)).xyz;
    gl_Position = Projection * ModelView * vec4(inPosition, 1.0);
}