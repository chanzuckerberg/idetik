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

// Transformation matrices
uniform mat4 InverseModelView;

// Volume rendering parameters
uniform bool ShowHitMisses;

// Volume rendering parameters
uniform float SampleDensity;
uniform float MaxIntensity;
uniform float OpacityScale;
uniform vec3 VolumeColor;
uniform float AlphaThreshold;

in vec3 Position;
in vec4 ViewPosition;

bool intersectBox(vec3 rayOrigin, vec3 rayDir, out float tEnter, out float tExit) {
    vec3 invDir = 1.0 / rayDir;
    // The bbox is normalized already
    vec3 t0 = (-0.5 - rayOrigin) * invDir;
    vec3 t1 = (0.5 - rayOrigin) * invDir;

    vec3 tMin = min(t0, t1);
    vec3 tMax = max(t0, t1);

    tEnter = max(max(tMin.x, tMin.y), tMin.z);
    tExit = min(min(tMax.x, tMax.y), tMax.z);

    return (tExit >= tEnter) && (tExit >= 0.0);
}

void main() {
    // Ray direction in view space points toward camera
    vec3 rayOriginView = ViewPosition.xyz;
    vec3 rayDirView = normalize(-rayOriginView);

    // Transform to model space for intersection test
    vec3 rayDirModel = normalize((InverseModelView * vec4(rayDirView, 0.0)).xyz);

    // Find the start and end of the ray within the volume
    float tEnter, tExit;
    vec3 rayOriginModel = Position;
    bool hit = intersectBox(rayOriginModel, rayDirModel, tEnter, tExit);

    // Discard fragments that miss the volume
    if (!hit) {
        if (ShowHitMisses) {
            fragColor = vec4(1.0, 0.0, 0.0, 1.0);
            return;
        }
        // Because we later clamp the number of samples to at least 1,
        // and position starts at entry point,
        // we don't have to discard here
        //discard;
    }

    // Find the texture coordinates of the entry and exit points
    tEnter = max(tEnter, 0.0);
    vec3 entryPointModel = rayOriginModel + rayDirModel * tEnter;
    vec3 exitPointModel = rayOriginModel + rayDirModel * tExit;

    // Convert model space positions to texture coordinates [0,1]
    // With normalized BoxSize, model space is already [-0.5, 0.5], so just shift to [0,1]
    vec3 entryPointNormalized = entryPointModel + 0.5;
    vec3 exitPointNormalized = exitPointModel + 0.5;

    // Calculate step direction before clamping to maintain consistent sampling
    vec3 step = exitPointNormalized - entryPointNormalized;
    float rayLength = length(step);

    // Now clamp for texture sampling (but keep original step/rayLength)
    entryPointNormalized = clamp(entryPointNormalized, 0.0, 1.0);
    exitPointNormalized = clamp(exitPointNormalized, 0.0, 1.0);

    // Raymarch from entry to exit point
    vec3 position = entryPointNormalized;

    // Use normalized texture space distance for consistent sampling across all chunks
    // This ensures uniform sample density regardless of chunk size
    int numSamples = int(ceil(rayLength * SampleDensity));
    numSamples = clamp(numSamples, 1, 512);

    // Compute step increment directly to avoid precision loss
    vec3 stepIncrement = step / float(numSamples);

    vec4 accumulatedColor = vec4(0.0);

    // Front-to-back compositing
    vec4 sampledData;
    float intensityScale = (1.0 / MaxIntensity) * OpacityScale;
    float sampleAlpha;
    float blendedSampleAlpha;

    for (int i = 0; i < numSamples && accumulatedColor.a < AlphaThreshold; i++) {
        sampledData = vec4(texture(ImageSampler, position));
        sampleAlpha = sampledData.r * intensityScale;

        blendedSampleAlpha = (1.0 - accumulatedColor.a) * sampleAlpha;

        // Front-to-back compositing
        accumulatedColor.a += blendedSampleAlpha;
        accumulatedColor.rgb += VolumeColor * blendedSampleAlpha;
        position += stepIncrement;
    }

    fragColor = accumulatedColor;
}
