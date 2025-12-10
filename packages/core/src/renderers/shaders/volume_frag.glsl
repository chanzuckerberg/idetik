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
in highp vec3 RayOriginModel;

// The bounding box in model space is normalized to -0.5 to 0.5
vec3 boundingboxMin = vec3(-0.50);
vec3 boundingboxMax = vec3(0.50);

// Volume rendering parameters
uniform bool ShowHitMisses;
uniform float SampleDensity;
uniform float MaxIntensity;
uniform float OpacityScale;
uniform float AlphaThreshold;
uniform vec3 VolumeColor;

vec2 findBoxIntersectionsAlongRay(vec3 rayOrigin, vec3 rayDir, vec3 boxMin, vec3 boxMax) {
    vec3 reciprocalRayDir = 1.0 / rayDir;
    vec3 t0 = (boxMin - rayOrigin) * reciprocalRayDir;
    vec3 t1 = (boxMax - rayOrigin) * reciprocalRayDir;

    vec3 tMin = min(t0, t1);
    vec3 tMax = max(t0, t1);

    float tEnter = max(max(tMin.x, tMin.y), tMin.z);
    float tExit = min(min(tMax.x, tMax.y), tMax.z);

    return vec2(tEnter, tExit);
}

void main() {
    // Step 1 - calculate where the ray enters and exits the volume

    // The ray in model space goes from the point on the back face to the camera
    vec3 RayDirModel = normalize(CameraPositionModel - RayOriginModel);
    // Move the ray a little bit off the surface to help avoid issues with the entry point calculation
    vec3 rayOrigin = RayOriginModel - RayDirModel * 0.1;

    vec2 rayIntersections = findBoxIntersectionsAlongRay(
        rayOrigin, RayDirModel, boundingboxMin, boundingboxMax
    );
    float tEnter = rayIntersections.x;
    float tExit = rayIntersections.y;

    // Redo the calculation with a slightly bigger box if the ray direction was flipped
    bool emptyRay = tExit < 0.0 || (tExit < tEnter);
    if (emptyRay && !ShowHitMisses) {
        vec2 rayIntersections = findBoxIntersectionsAlongRay(
            rayOrigin, RayDirModel, boundingboxMin - vec3(0.015), boundingboxMax + vec3(0.015)
        );
        tEnter = rayIntersections.x;
        tExit = rayIntersections.y;
    }

    // The exit point is the start of the ray in front to back compositing
    // because we are rendering back faces
    // We also map the coordinates from [-0.5, 0.5] to [0, 1] for texture sampling
    vec3 entryPoint = rayOrigin + RayDirModel * tExit;
    entryPoint = clamp(entryPoint + 0.5, 0.0, 1.0);
    vec3 exitPoint = rayOrigin + RayDirModel * tEnter;
    exitPoint = clamp(exitPoint + 0.5, 0.0, 1.0);

    // Step 2 - calculate the number of samples based on the length of the ray
    vec3 rayWithinModel = exitPoint - entryPoint;
    float rayLength = length(rayWithinModel);
    int numSamples = max(int(ceil(rayLength * SampleDensity)), 1);
    vec3 stepIncrement = rayWithinModel / float(numSamples);

    // Step 3 - perform the ray marching and compositing in front to back order
    vec3 position = entryPoint;
    vec4 accumulatedColor = vec4(0.0);
    float sampledData, sampleAlpha, blendedSampleAlpha;

    // Later replace by an invlerp, but overall provides a way to map the incoming
    // sampled texture value to an alpha value
    float intensityScale = (1.0 / MaxIntensity) * OpacityScale;

    // March until we reach the number of samples or accumulate enough opacity
    for (int i = 0; i < numSamples && accumulatedColor.a < AlphaThreshold; i++) {
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
