#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

uniform mediump usampler2D texture0;
uniform vec2 offsetST;
uniform vec2 scaleST;

in vec2 TexCoords;

void main() {
    // TODO: normalization of the value should be controlled by variable
    // parameters (e.g. contrast limits).
    // https://github.com/chanzuckerberg/imaging-active-learning/issues/32
    // offset and scale for partial/multiscale texture
    vec2 texCoords = (TexCoords - offsetST.st) * scaleST.st;
    float value = float(texture(texture0, texCoords).r) / 256.0;
    fragColor = vec4(value, value, value, 1);
    if (texCoords.x < 0.0 || texCoords.x > 1.0 || texCoords.y < 0.0 || texCoords.y > 1.0) {
        fragColor = vec4(0.25, 0.0, 0.25, 1.0);
    } else {
        fragColor = vec4(value, value, value, 1.0);
    }
}
