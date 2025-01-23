#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

uniform sampler2D texture0;
// This is currently unused in the shader because we assume that the
// rgb values are already normalized appropriately.
// We include it so that the mesh shaders with textures can all set
// this uniform in the same way.
// TODO: use or remove this.
uniform vec2 ContrastLimits;

in vec2 TexCoords;

void main() {
    fragColor = vec4(texture(texture0, TexCoords).rgb, 1.0);
}