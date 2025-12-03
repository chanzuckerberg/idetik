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
uniform mat4 ModelView;

// Volume bounding box (model space)
uniform vec3 BoxSize;
uniform bool ShowHitMisses;

in vec3 ModelPosition;

bool intersectBox(vec3 rayOrigin, vec3 rayDir, vec3 boxMin, vec3 boxMax, out float tEnter, out float tExit) {
    vec3 invDir = 1.0 / rayDir;
    vec3 t0 = (boxMin - rayOrigin) * invDir;
    vec3 t1 = (boxMax - rayOrigin) * invDir;

    vec3 tMin = min(t0, t1);
    vec3 tMax = max(t0, t1);

    tEnter = max(max(tMin.x, tMin.y), tMin.z);
    tExit = min(min(tMax.x, tMax.y), tMax.z);

    return (tExit >= tEnter) && (tExit >= 0.0);
}

void main() {
    // Volume rendering parameters (usually uniforms, but set as constant for now)
    float SampleDensity = 512.0;
    float MaxIntensity = 512.0;
    float OpacityScale = 0.1;
    vec3 VolumeColor = vec3(1.0, 1.0, 1.0);
    float AlphaThreshold = 0.99;

    // Use model position directly - more stable than using gl_Position (interpolated)
    // Transform model position to view space to get the ray origin on the cube surface
    vec4 viewPos = ModelView * vec4(ModelPosition, 1.0);

    // Ray direction in view space points toward camera
    vec3 rayOriginView = viewPos.xyz;
    vec3 rayDirView = normalize(-rayOriginView);

    // Transform to model space for intersection test
    mat4 inverseModelView = inverse(ModelView);
    vec3 rayDirModel = normalize((inverseModelView * vec4(rayDirView, 0.0)).xyz);

    // Box bounds in model space
    vec3 boxMinModel = -BoxSize * 0.5;
    vec3 boxMaxModel = BoxSize * 0.5;

    // Find the start and end of the ray within the volume
    float tEnter, tExit;
    vec3 rayOriginModel = ModelPosition;
    bool hit = intersectBox(rayOriginModel, rayDirModel, boxMinModel, boxMaxModel, tEnter, tExit);

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
    vec3 entryPointNormalized = (entryPointModel / BoxSize) + 0.5;
    vec3 exitPointNormalized = (exitPointModel / BoxSize) + 0.5;

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

    vec3 accumulatedColor = vec3(0.0);
    float alpha = 0.0;

    for (int i = 0; i < numSamples; i++) {
        vec4 sampledData;

#if defined(TEXTURE_DATA_TYPE_INT)
        ivec4 rawData = texture(ImageSampler, position);
        sampledData = vec4(rawData);
#elif defined(TEXTURE_DATA_TYPE_UINT)
        uvec4 rawData = texture(ImageSampler, position);
        sampledData = vec4(rawData);
#else
        sampledData = texture(ImageSampler, position);
#endif
        float texel = sampledData.r;

        float normalizedIntensity = texel / MaxIntensity;
        float sampleAlpha = normalizedIntensity * OpacityScale;

        // Front-to-back compositing
        vec3 sampleColor = VolumeColor;
        float prevAlpha = alpha;
        alpha = alpha + (1.0 - alpha) * sampleAlpha;
        accumulatedColor += sampleColor * sampleAlpha * (1.0 - prevAlpha);

        if (alpha >= AlphaThreshold) {
            break;
        }
        position += stepIncrement;
    }

    fragColor = vec4(accumulatedColor, alpha);
}
