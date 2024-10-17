#version 300 es

layout (location = 0) in vec3 inPosition;

uniform mat4 Projection;
uniform mat4 ModelView;

// adapted from https://github.com/mattdesl/webgl-lines
void main() {
    mat4 projModelView = Projection * ModelView;
    gl_Position = projModelView * vec4(inPosition, 1.0);
}
