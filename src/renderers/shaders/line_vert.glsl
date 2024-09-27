#version 300 es

layout (location = 0) in vec3 inPosition;
layout (location = 3) in vec3 inPrevPosition;
layout (location = 4) in vec3 inNextPosition;
layout (location = 5) in float direction;

uniform mat4 Projection;
uniform mat4 ModelView;
uniform vec2 Resolution;
uniform float LineWidth;

out float distanceFromCenter;

void main() {
    mat4 projModelView = Projection * ModelView;

    vec4 prevPos = projModelView * vec4(inPrevPosition, 1.0);
    vec4 currPos = projModelView * vec4(inPosition, 1.0);
    vec4 nextPos = projModelView * vec4(inNextPosition, 1.0);

    vec2 aspectVec = vec2(Resolution.x / Resolution.y, 1.0);
    vec2 prevScreen = (prevPos.xy / prevPos.w) * aspectVec;
    vec2 currScreen = (currPos.xy / currPos.w) * aspectVec;
    vec2 nextScreen = (nextPos.xy / nextPos.w) * aspectVec;
    float currZ = currPos.z / currPos.w;

    vec2 diff;
    if (prevScreen == currScreen) {
        // first point on the path
        diff = nextScreen - currScreen;
    } else if (nextScreen == currScreen) {
        // last point on the path
        diff = currScreen - prevScreen;
    } else {
        vec2 prevDiff = currScreen - prevScreen;
        vec2 nextDiff = nextScreen - currScreen;
        diff = normalize(prevDiff) + normalize(nextDiff);
    }

    vec2 normal = normalize(vec2(-diff.y, diff.x));

    vec4 offset = vec4(
        normal * direction * LineWidth / 2.0 / aspectVec.xy,
        currZ,
        1.0
    );
    gl_Position = currPos + offset;

    // distance from center
    distanceFromCenter = direction;

    // draw as GL_POINTS for debugging
    gl_PointSize = 5.0;
}
