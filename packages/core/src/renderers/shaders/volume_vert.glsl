#version 300 es

precision highp float;

layout (location = 0) in vec3 inPosition;
layout (location = 2) in vec2 inUV;

uniform mat4 Projection;
uniform mat4 ModelView, InverseModelView;

out vec2 TexCoords;
out vec3 RayOriginModel;

void main() {
    TexCoords = inUV;
    RayOriginModel = inPosition;

    vec4 positionVector = vec4(inPosition, 1.0);
    gl_Position = Projection * ModelView * positionVector;
}
