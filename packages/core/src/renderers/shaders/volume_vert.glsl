#version 300 es

precision highp float;

layout (location = 0) in vec3 inPosition;

uniform highp mat4 ModelViewProjection;
out highp vec3 RayOriginModel;

void main() {
    RayOriginModel = inPosition;

    vec4 positionVector = vec4(inPosition, 1.0);
    gl_Position = ModelViewProjection * positionVector;
}
