#version 300 es
#pragma inject_defines

precision highp float;

layout (location = 0) out vec4 FragData0;
// TODO will become a float later
layout (location = 1) out vec4 FragData1;

#if defined TEXTURE_DATA_TYPE_INT
uniform mediump isampler3D ImageSampler;
#elif defined TEXTURE_DATA_TYPE_UINT
uniform mediump usampler3D ImageSampler;
#else
uniform mediump sampler3D ImageSampler;
#endif

uniform highp vec3 CameraPositionModel;
uniform mat4 Projection;
uniform mat4 ModelView;
in highp vec3 PositionModel;

// The bounding box in model space is normalized to -0.5 to 0.5
vec3 boundingboxMin = vec3(-0.50);
vec3 boundingboxMax = vec3(0.50);

// Volume rendering parameters
uniform bool DebugShowDegenerateRays;
uniform float SamplesPerUnit;
uniform float MaxIntensity;
uniform float OpacityMultiplier;
uniform float EarlyTerminationAlpha;
uniform vec3 VolumeColor;

float computeOITWeighta(float alpha, float depth) {
    float d = (1.0 - depth);
    return alpha * max(1e-2, 3e3 * d * d * d);
}

float computeOITWeight(float alpha, float depth) {
  float a = min(1.0, alpha) * 8.0 + 0.01;
  float b = -depth * 0.95 + 1.0;
  return a * a * a * b * b * b;
}

vec2 findBoxIntersectionsAlongRay(vec3 rayOrigin, vec3 rayDir, vec3 boxMin, vec3 boxMax) {
    vec3 reciprocalRayDir = 1.0 / rayDir;
    vec3 t0 = (boxMin - rayOrigin) * reciprocalRayDir;
    vec3 t1 = (boxMax - rayOrigin) * reciprocalRayDir;

    vec3 tMin = min(t0, t1);
    vec3 tMax = max(t0, t1);

    float tEnter = max(max(tMin.x, tMin.y), tMin.z);
    float tExit = min(min(tMax.x, tMax.y), tMax.z);
    tEnter = max(0.0, tEnter);
    tExit = max(tEnter, tExit);

    return vec2(tEnter, tExit);
}

void main() {
    // Step 1 - calculate where the ray enters and exits the volume

    // The ray in model space goes from the camera to the point on the back face
    vec3 RayDirModel = normalize(PositionModel - CameraPositionModel);

    vec2 rayIntersections = findBoxIntersectionsAlongRay(CameraPositionModel, RayDirModel, boundingboxMin, boundingboxMax);
    float tEnter = rayIntersections.x;
    float tExit = rayIntersections.y;

    if (DebugShowDegenerateRays && (tExit == tEnter)) {
        FragData0 = vec4(1.0, 0.0, 0.0, 1.0);
        FragData1 = vec4(1.0, 0.0, 0.0, 0.0);
        return;
    }

    vec3 entryPoint = CameraPositionModel + RayDirModel * tEnter;
    entryPoint = clamp(entryPoint + 0.5, 0.0, 1.0);
    vec3 exitPoint = CameraPositionModel + RayDirModel * tExit;
    exitPoint = clamp(exitPoint + 0.5, 0.0, 1.0);

    // Step 2 - calculate the number of samples based on the length of the ray
    vec3 rayWithinModel = exitPoint - entryPoint;
    float rayLength = length(rayWithinModel);
    int numSamples = max(int(ceil(rayLength * SamplesPerUnit)), 1);
    vec3 stepIncrement = rayWithinModel / float(numSamples);

    // Step 3 - perform the ray marching and compositing in front to back order
    vec3 position = entryPoint;
    vec4 clipPosition;
    vec4 accumulatedColor = vec4(0.0);
    float revealage = 1.0;
    float sampledData, sampleAlpha, blendedSampleAlpha, rayDepth, weightedAlpha;

    // Later replace by an invlerp, but overall provides a way to map the incoming
    // sampled texture value to an alpha value
    float intensityScale = (1.0 / MaxIntensity);

    // March until we reach the number of samples or accumulate enough opacity
    for (int i = 0; i < numSamples; i++) {
        sampledData = vec4(texture(ImageSampler, position)).r;
        sampleAlpha = clamp(sampledData * intensityScale * OpacityMultiplier, 0.0, 1.0);
        clipPosition = Projection * ModelView * vec4(position, 1.0);
        rayDepth  = (clipPosition.z / clipPosition.w) * 0.5 + 0.5;

        // Weighted blended OIT
        weightedAlpha = sampleAlpha * computeOITWeighta(sampleAlpha, rayDepth);
        accumulatedColor += vec4(VolumeColor * intensityScale * 250.0 * weightedAlpha, weightedAlpha);
        revealage *= 1.0 - sampleAlpha;
        position += stepIncrement;
    }

    FragData0 = vec4(accumulatedColor.rgb, 1.0 - revealage);
    FragData1 = vec4(accumulatedColor.a, 0.0, 0.0, 0.0);
}
