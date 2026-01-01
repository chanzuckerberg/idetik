#version 300 es
#pragma inject_defines

precision highp float;

layout (location = 0) out vec4 fragColor;

#if defined TEXTURE_DATA_TYPE_INT
uniform mediump sampler3D ImageSampler;
#elif defined TEXTURE_DATA_TYPE_UINT
uniform mediump usampler3D ImageSampler;
#else
uniform mediump sampler3D ImageSampler;
#endif

uniform highp vec3 CameraPositionModel;
in highp vec3 PositionModel;
in vec2 TexCoords;

// The bounding box in model space is normalized to -0.5 to 0.5
vec3 boundingboxMin = vec3(-0.50);
vec3 boundingboxMax = vec3(0.50);

// Volume rendering parameters
uniform bool EnableRayCorrection;
uniform float SampleDensity;
uniform float MaxIntensity;
uniform float OpacityScale;
uniform float AlphaThreshold;

// Multi-channel support (backwards compatible with single channel)
#define MAX_CHANNELS 32
uniform uint ChannelCount;
uniform bool Visible[MAX_CHANNELS];
uniform vec3 Color[MAX_CHANNELS];
uniform float ValueOffset[MAX_CHANNELS];
uniform float ValueScale[MAX_CHANNELS];
uniform float DepthSlices; // Number of Z slices (for Texture3DArray array index calculation)

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

    // The ray in model space goes from the camera to the point on the back face
    vec3 RayDirModel = normalize(PositionModel - CameraPositionModel);

    vec2 rayIntersections = findBoxIntersectionsAlongRay(
        CameraPositionModel, RayDirModel, boundingboxMin, boundingboxMax
    );
    float tEnter = rayIntersections.x;
    float tExit = rayIntersections.y;

    // Redo the calculation with a slightly bigger box if the ray direction was flipped
    bool invalidIntersection = tExit < 0.0 || (tExit < tEnter);
    if (invalidIntersection && EnableRayCorrection) {
        // vec2 rayIntersections = findBoxIntersectionsAlongRay(
        //     CameraPositionModel, RayDirModel, boundingboxMin - vec3(0.015), boundingboxMax + vec3(0.015)
        // );
        // tEnter = rayIntersections.x;
        // tExit = rayIntersections.y;
        fragColor = vec4(1.0, 0.0, 0.0, 1.0);
        return;
    }
    tExit = max(tEnter, tExit);

    vec3 entryPoint = CameraPositionModel + RayDirModel * tEnter;
    entryPoint = clamp(entryPoint + 0.5, 0.0, 1.0);
    vec3 exitPoint = CameraPositionModel + RayDirModel * tExit;
    exitPoint = clamp(exitPoint + 0.5, 0.0, 1.0);

    // Step 2 - calculate the number of samples based on the length of the ray
    vec3 rayWithinModel = exitPoint - entryPoint;
    float rayLength = length(rayWithinModel);
    int numSamples = max(int(ceil(rayLength * SampleDensity)), 1);
    vec3 stepIncrement = rayWithinModel / float(numSamples);

    // Step 3 - perform the ray marching and compositing in front to back order
    vec3 position = entryPoint;
    vec4 accumulatedColor = vec4(0.0);

    // Later replace by an invlerp, but overall provides a way to map the incoming
    // sampled texture value to an alpha value
    float intensityScale = OpacityScale;

    //fragColor = vec4(1.0, 0.0, 0.0, 1.0);
    //return;

    float channelScale = 1.0 / float(ChannelCount);

    for (int i = 0; i < numSamples && accumulatedColor.a < AlphaThreshold; i++) {
        vec3 sampleColor = vec3(0.0);
        float totalAlpha = 0.0;

        // Sample all visible channels and composite them
        for (uint ch = 0u; ch < ChannelCount; ch++) {
            if (!Visible[ch]) continue;
            float thisChannelScale = float(ch) * channelScale;

            // For Texture3DArray we pick the right index: array index = z_slice + channel * num_z_slices
            // position.z is in [0,1], scale it to slice index
            position.z = position.z * channelScale + thisChannelScale;

            float texel = float(texture(ImageSampler, position).r);
            float value = (texel + ValueOffset[ch]) * ValueScale[ch];

            float sampleAlpha = clamp(value, 0.0, 1.0);
            sampleColor += sampleAlpha * Color[ch];
            totalAlpha += sampleAlpha * channelScale * intensityScale;
        }

        // Clamp total alpha to prevent over-saturation with multiple channels
        totalAlpha = clamp(totalAlpha, 0.0, 1.0);
        float blendedSampleAlpha = (1.0 - accumulatedColor.a) * totalAlpha * 0.001;

        // Front-to-back compositing
        accumulatedColor.a += blendedSampleAlpha;
        accumulatedColor.rgb += sampleColor * blendedSampleAlpha;
        position += stepIncrement;
    }

    fragColor = accumulatedColor;
}
