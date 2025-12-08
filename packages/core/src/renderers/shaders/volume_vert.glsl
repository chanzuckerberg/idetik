#version 300 es

layout (location = 0) in vec3 inPosition;
layout (location = 2) in vec2 inUV;

uniform mat4 Projection;
uniform mat4 ModelView;

out vec2 TexCoords;
out vec3 Position;
out vec4 ViewPosition;

void main() {
    vec4 positionVector = vec4(inPosition, 1.0);
    TexCoords = inUV;
    Position = inPosition;
    ViewPosition = ModelView * positionVector;  // Transform model position to view space to get the ray origin on the cube surface
    gl_Position = Projection * ModelView * positionVector;
}
