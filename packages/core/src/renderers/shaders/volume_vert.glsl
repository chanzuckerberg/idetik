#version 300 es

layout (location = 0) in vec3 inPosition;
layout (location = 2) in vec2 inUV;

uniform mat4 Projection;
uniform mat4 ModelView;

out vec2 TexCoords;
out vec3 VNormalized;

void main() {
    TexCoords = inUV;
    gl_Position = Projection * ModelView * vec4(inPosition, 1.0);
    VNormalized = gl_Position.xyz / gl_Position.w;
}
