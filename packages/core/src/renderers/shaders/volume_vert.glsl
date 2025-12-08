#version 300 es

layout (location = 0) in vec3 inPosition;
layout (location = 2) in vec2 inUV;

uniform mat4 Projection;
uniform mat4 ModelView, InverseModelView;

out vec2 TexCoords;
out vec3 RayDirModel, RayOriginModel;

void main() {
    TexCoords = inUV;

    vec4 positionVector = vec4(inPosition, 1.0);
    gl_Position = Projection * ModelView * positionVector;

    vec3 rayOriginView = (ModelView * positionVector).xyz;   // Transform model position to view space to get the ray origin on the cube surface
    RayDirModel = normalize((InverseModelView * vec4(normalize(-rayOriginView), 0.0)).xyz);
    RayOriginModel = inPosition;

}
