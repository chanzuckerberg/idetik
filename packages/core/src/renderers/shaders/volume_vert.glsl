#version 300 es

precision highp float;

layout (location = 0) in vec3 inPosition;

uniform mat4 Projection;
uniform mat4 ModelView;
out highp vec3 PositionModel;

void main() {
    PositionModel = inPosition;
    gl_Position = Projection * ModelView * vec4(inPosition, 1.0);
    TexCoords = inUV;
}
