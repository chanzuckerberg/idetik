#version 300 es

layout (location = 0) in vec3 inPosition;
layout (location = 2) in vec2 inUV;

uniform mat4 Projection;
uniform mat4 ModelView;

out vec2 TexCoords;
out vec3 ModelPosition;

void main() {
    TexCoords = inUV;
    ModelPosition = inPosition;
    gl_Position = Projection * ModelView * vec4(inPosition, 1.0);
}
