#version 300 es

const float PI = 3.14159265;

layout (location = 0) in vec3 inPosition;
layout (location = 3) in vec3 inPrevPosition;
layout (location = 4) in vec3 inNextPosition;
layout (location = 5) in float direction;
layout (location = 6) in float path_proportion;

uniform mat4 Projection;
uniform mat4 ModelView;
uniform vec2 Resolution;
uniform float LineWidth;
uniform float TaperOffset;
uniform float TaperPower;

// adapted from https://github.com/mattdesl/webgl-lines
void main() {
    mat4 projModelView = Projection * ModelView;

    vec4 prevPos = projModelView * vec4(inPrevPosition, 1.0);
    vec4 currPos = projModelView * vec4(inPosition, 1.0);
    vec4 nextPos = projModelView * vec4(inNextPosition, 1.0);

    vec2 aspectVec = vec2(Resolution.x / Resolution.y, 1.0);
    vec2 prevScreen = (prevPos.xy / prevPos.w) * aspectVec;
    vec2 currScreen = (currPos.xy / currPos.w) * aspectVec;
    vec2 nextScreen = (nextPos.xy / nextPos.w) * aspectVec;

    // direction is + or -; which way to project the vertex away from the path
    // path_proportion is the distance along the path, from 0 to 1
    float d = sign(direction);
    float taper = 1.0;
    if (TaperPower > 0.0) {
      // glsl `pow(x, y)` is undefined if x < 0 or x = 0 and y <= 0
      float t = clamp(path_proportion - TaperOffset, -0.5, 0.5);
      float angle = PI * t;
      taper = pow(cos(angle), TaperPower);
    }

    // `normal` points perpendicular to the path in screen space
    vec2 normal;
    // `miterLength` extends the offset along the normal (with a limit)
    // this make a nicer corner and keeps the line thickness more uniform;
    float miterLength = 1.0;
    if (prevPos == currPos) {
        // first point on the path
        vec2 dir = normalize(nextScreen - currScreen);
        normal = vec2(-dir.y, dir.x);
    } else if (nextPos == currPos) {
        // last point on the path
        vec2 dir = normalize(currScreen - prevScreen);
        normal = vec2(-dir.y, dir.x);
    } else {
        // middle point on the path: add miter along the bisector
        vec2 prevDir = normalize(currScreen - prevScreen);
        vec2 nextDir = normalize(nextScreen - currScreen);
        vec2 tangent = normalize(prevDir + nextDir);
        normal = vec2(-tangent.y, tangent.x);
        vec2 perpPrev = vec2(-prevDir.y, prevDir.x);
        miterLength = 1.0 / max(dot(normal, perpPrev), 0.1);
    }

    // `normal * LineWidth / Resolution` means LineWidth is in pixels
    vec4 offset = vec4(
        (normal * LineWidth / Resolution) * miterLength * taper * d,
        0.0,
        0.0
    );
    gl_Position = currPos + offset * currPos.w;

    // draw as GL_POINTS for debugging
    gl_PointSize = 5.0;
}
