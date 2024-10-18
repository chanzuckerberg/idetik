#version 300 es

layout (location = 0) in vec3 inPosition;
layout (location = 1) in vec3 inNormal;
layout (location = 2) in vec2 inUV;

uniform mat4 Projection;
uniform mat4 ModelView;
uniform vec3 Flips;

out vec2 TexCoords;

void main() {
    float uvX = float(Flips.x < 0.0) + (Flips.x * inUV.x);
    float uvY = float(Flips.y < 0.0) + (Flips.y * inUV.y);
    TexCoords = vec2(uvX, uvY);
    gl_Position = Projection * ModelView * vec4(inPosition, 1.0);
}