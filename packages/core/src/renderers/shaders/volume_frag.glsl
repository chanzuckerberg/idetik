#version 300 es
#pragma inject_defines

precision highp float;

layout (location = 0) out vec4 fragColor;

#if defined TEXTURE_DATA_TYPE_INT
uniform mediump isampler3D ImageSampler;
#elif defined TEXTURE_DATA_TYPE_UINT
uniform mediump usampler3D ImageSampler;
#else
uniform mediump sampler3D ImageSampler;
#endif

uniform highp vec3 CameraPositionModel;
in highp vec3 PositionModel;

// The bounding box in model space is normalized to -0.5 to 0.5
vec3 boundingboxMin = vec3(-0.50);
vec3 boundingboxMax = vec3(0.50);

// Volume rendering parameters
uniform bool DebugShowDegenerateRays;
uniform float MaxIntensity;
uniform float OpacityMultiplier;
uniform float EarlyTerminationAlpha;
uniform vec3 VolumeColor;

uniform vec3 ChunkWorldSize;
uniform float SamplesPerWorldUnit;

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
        fragColor = vec4(1.0, 0.0, 0.0, 1.0);
        return;
    }

    vec3 entryPoint = CameraPositionModel + RayDirModel * tEnter;
    entryPoint = clamp(entryPoint + 0.5, 0.0, 1.0);
    vec3 exitPoint = CameraPositionModel + RayDirModel * tExit;
    exitPoint = clamp(exitPoint + 0.5, 0.0, 1.0);

    // Step 2 - calculate the number of samples based on the length of the ray
    // The ray is in normalized texture space [0,1]. We scale by ChunkWorldSize to get
    // the world-space length, then multiply by SamplesPerWorldUnit (which is the same
    // across all chunks in a volume/LOD) to get a consistent number of samples.
    // This ensures a ray through a skinny chunk gets fewer samples than a ray through
    // a fat chunk, proportionally to their world-space sizes.
    vec3 rayWithinModel = exitPoint - entryPoint;

    // Convert ray from texture space (0, 1) to world space
    vec3 rayInWorldSpace = rayWithinModel * ChunkWorldSize;
    float rayLengthWorld = length(rayInWorldSpace);
    int numSamples = max(int(ceil(rayLengthWorld * SamplesPerWorldUnit)), 1);
    vec3 stepIncrement = rayWithinModel / float(numSamples);

    // Step 3 - perform the ray marching and compositing in front to back order
    vec3 position = entryPoint;
    vec4 accumulatedColor = vec4(0.0);
    float sampledData, sampleAlpha, blendedSampleAlpha;

    // Later replace by an invlerp, but overall provides a way to map the incoming
    // sampled texture value to an alpha value
    float intensityScale = (1.0 / MaxIntensity) * OpacityMultiplier;

    // March until we reach the number of samples or accumulate enough opacity
    for (int i = 0; i < numSamples && accumulatedColor.a < EarlyTerminationAlpha; i++) {
        sampledData = vec4(texture(ImageSampler, position)).r;
        sampleAlpha = sampledData * intensityScale;
        blendedSampleAlpha = (1.0 - accumulatedColor.a) * sampleAlpha;

        // Front-to-back compositing
        accumulatedColor.a += blendedSampleAlpha;
        accumulatedColor.rgb += VolumeColor * blendedSampleAlpha;
        position += stepIncrement;
    }

    fragColor = accumulatedColor;
}
