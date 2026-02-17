#version 300 es
#pragma inject_defines

precision highp float;

layout (location = 0) out vec4 FragData0;
// TODO will become a float later
layout (location = 1) out vec4 FragData1;
layout (location = 2) out vec4 FragDepth;

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
uniform float MaxIntensity;
uniform float OpacityMultiplier;
uniform float EarlyTerminationAlpha;
uniform float RelativeStepSize;
uniform vec3 Color;
uniform float ValueOffset;
uniform float ValueScale;
uniform vec3 VoxelScale;
uniform bool DebugShowDegenerateRays;
uniform bool DebugShowChunkBoundaries;

float computeOITWeight(float alpha, float depth) {
    float d = (1.0 - depth);
    return alpha * max(1e-2, 3e5 * d);
}

float computeOITWeightDebug(float alpha, float depth) {
    return 1.0;
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
    // Initialize outputs to defaults for early exit cases
    FragData0 = vec4(0.0, 0.0, 0.0, 0.0);
    FragData1 = vec4(0.0, 0.0, 0.0, 0.0);
    FragDepth = vec4(1.0);

    if (DebugShowChunkBoundaries) {
        vec3 distToMin = abs(PositionModel - boundingboxMin);
        vec3 distToMax = abs(PositionModel - boundingboxMax);
        bvec3 nearMin = lessThan(distToMin, vec3(0.01));
        bvec3 nearMax = lessThan(distToMax, vec3(0.01));
        bvec3 nearBoundary = bvec3(nearMin.x || nearMax.x, nearMin.y || nearMax.y, nearMin.z || nearMax.z);
        int numDimsOnBoundary = int(nearBoundary.x) + int(nearBoundary.y) + int(nearBoundary.z);
        bool onEdge = numDimsOnBoundary >= 2;
        if (onEdge) {
            FragData0 = vec4(1.0, 1.0, 1.0, 0.4);
            FragData1 = vec4(1.0, 0.0, 0.0, 0.0);
            FragDepth = vec4(1.0);
        }
        return;
    }

    // Step 1 - calculate where the ray enters and exits the volume

    // The ray in model space goes from the camera to the point on the back face
    vec3 RayDirModel = normalize(PositionModel - CameraPositionModel);

    vec2 rayIntersections = findBoxIntersectionsAlongRay(CameraPositionModel, RayDirModel, boundingboxMin, boundingboxMax);
    float tEnter = rayIntersections.x;
    float tExit = rayIntersections.y;

    if (DebugShowDegenerateRays && (tExit == tEnter)) {
        FragData0 = vec4(1.0, 0.0, 0.0, 1.0);
        FragData1 = vec4(1.0, 0.0, 0.0, 0.0);
        FragDepth = vec4(1.0);
        return;
    }

    vec3 entryPoint = CameraPositionModel + RayDirModel * tEnter;
    entryPoint = clamp(entryPoint + 0.5, 0.0, 1.0);
    vec3 exitPoint = CameraPositionModel + RayDirModel * tExit;
    exitPoint = clamp(exitPoint + 0.5, 0.0, 1.0);

    // Step 2 - calculate the number of samples based on the length of the ray
    // The ray is in normalized texture space [0,1]. Convert to voxel space to determine
    // the appropriate number of samples. RelativeStepSize controls how many voxels to
    // skip per sample (e.g., 1.0 = one sample per voxel, 0.5 = two samples per voxel).
    vec3 rayWithinModel = exitPoint - entryPoint;

    // Get texture dimensions and convert ray to voxel space
    vec3 textureSize = vec3(textureSize(ImageSampler, 0));
    vec3 rayInVoxels = rayWithinModel * textureSize;
    float rayLengthInVoxels = length(rayInVoxels);
    int numSamples = max(int(ceil(rayLengthInVoxels / RelativeStepSize)), 1);
    vec3 stepIncrement = rayWithinModel / float(numSamples);

    // Calculate actual world-space step size for opacity correction.
    // This accounts for anisotropic voxels so brightness stays constant regardless
    // of viewing angle. For anisotropic voxels (e.g., 1x1x3 microns), rays along
    // different axes traverse different amounts of material per step.
    vec3 stepInWorldSpace = stepIncrement * textureSize * VoxelScale;
    float worldSpaceStepSize = length(stepInWorldSpace);

    // Step 3 - perform the ray marching and compositing in front to back order
    vec3 position = entryPoint;
    vec4 clipPosition;
    vec4 accumulatedColor = vec4(0.0);
    vec3 sampleColor;
    float revealage = 1.0;
    float sampledData, sampleAlpha, blendedSampleAlpha, rayDepth, weight, scaledData;

    // Scale intensity to opacity.
    // ValueScale is the
    // worldSpaceStepSize corrects for anisotropic voxels.
    float intensityScale = ValueScale * worldSpaceStepSize;

    // March until we reach the number of samples or accumulate enough opacity
    for (int i = 0; i < numSamples && revealage > (1.0 - EarlyTerminationAlpha); i++) {
        // Sample the volume data and convert to color and opacity
        sampledData = vec4(texture(ImageSampler, position)).r;
        scaledData = (sampledData + ValueOffset) * intensityScale;
        // OpacityMultiplier controls the gain
        sampleAlpha = clamp(scaledData * OpacityMultiplier, 0.0, 1.0);
        sampleColor = Color * sampleAlpha; // TODO this or alpha - also gain

        // Weighted blended OIT
        clipPosition = Projection * ModelView * vec4(position, 1.0);
        rayDepth  = (clipPosition.z / clipPosition.w) * 0.5 + 0.5;
        weight = computeOITWeight(sampleAlpha, rayDepth);
        accumulatedColor += vec4(sampleColor, sampleAlpha) * weight;
        revealage *= clamp(1.0 - sampleAlpha, 0.0, 1.0);

        // Advance the ray
        position += stepIncrement;
    }

    FragData0 = vec4(accumulatedColor.rgb, 1.0 - revealage);
    FragData1 = vec4(accumulatedColor.a, 0.0, 0.0, 0.0);
    FragDepth = vec4(1.0);
}
