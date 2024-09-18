#version 300 es

layout (location = 0) in vec3 inPosition;
layout (location = 1) in vec3 inPrevPosition;
layout (location = 2) in vec3 inNextPosition;
layout (location = 3) in float direction;

uniform mat4 Projection;
uniform mat4 ModelView;
uniform vec2 Resolution;
uniform float LineWidth;

void main() {
    mat4 projModelView = Projection * ModelView;

    vec4 prevPos = projModelView * vec4(inPrevPosition, 1.0);
    vec4 currPos = projModelView * vec4(inPosition, 1.0);
    vec4 nextPos = projModelView * vec4(inNextPosition, 1.0);

    vec2 aspectVec = vec2(Resolution.x / Resolution.y, 1.0);
    vec2 prevScreen = (prevPos.xy / prevPos.w) * aspectVec;
    vec2 currScreen = (currPos.xy / currPos.w) * aspectVec;
    vec2 nextScreen = (nextPos.xy / nextPos.w) * aspectVec;

    vec2 diff;
    if (currScreen == prevScreen) {
        // this is the first segment
        diff = normalize(nextScreen - currScreen);
    } else {
        diff = normalize(currScreen - prevScreen);
    }

    vec2 normal = vec2(-diff.y, diff.x);
    normal *= LineWidth / 2.0 / aspectVec;
    if (normal.y < 0.0) {
        // we always want normal.y to point "up" in screen space
        // so the "direction" does not get flipped between segments
        normal = -normal;
    }
    vec4 offset = vec4(normal * direction, 0.0, 1.0);
    gl_Position = currPos + offset;

    // draw as GL_POINTS for debugging
    gl_PointSize = 5.0;
}
