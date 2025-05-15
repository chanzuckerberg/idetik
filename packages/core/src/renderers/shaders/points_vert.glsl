#version 300 es

precision mediump float;

layout (location = 0) in vec3 inPosition;
layout (location = 7) in vec3 inColor;
layout (location = 8) in float inSize;
layout (location = 9) in float inMarker;

uniform mat4 Projection;
uniform mat4 ModelView;

out vec4 color;
flat out uint marker;


void main() {
    gl_Position = Projection * ModelView * vec4(inPosition, 1.0);
    gl_PointSize = inSize;
    color = vec4(inColor, 1.0);
    marker = uint(inMarker);
}

