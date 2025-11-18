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
uniform mat4 InverseModelViewProjection;

// Volume bounding box (model space)
uniform vec3 BoxSize;

const vec3 boxMin = vec3(0.00);
const vec3 boxMax = vec3(1.000);

in vec4 NormalizedPosition;

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
    vec2 normalizedXY = clamp(NormalizedPosition.xy / NormalizedPosition.w, -1.0, 1.0);
    // Get the near and far points in model space (after InverseMVP, points are in model coords)
    vec4 nearPointHomogeneous = InverseModelViewProjection * vec4(normalizedXY, -1.0, 1.0);
    vec4 farPointHomogeneous = InverseModelViewProjection * vec4(normalizedXY, 1.0, 1.0);

    // Model space ranges from -BoxSize/2 to +BoxSize/2, normalize to [0, 1]
    vec3 nearPoint = (nearPointHomogeneous.xyz / nearPointHomogeneous.w) / BoxSize + 0.5;
    vec3 farPoint = (farPointHomogeneous.xyz / farPointHomogeneous.w) / BoxSize + 0.5;

    // Find the start and end of the ray within the volume from the near point to the far point
    float tEnter, tExit;
    vec3 rayOrigin = nearPoint;
    vec3 rayDir = normalize(farPoint - nearPoint);
    bool hit = intersectBox(rayOrigin, rayDir, boxMin, boxMax, tEnter, tExit);

    // Discard fragments that miss the volume
    if (!hit) {
        discard;
    }

    // Find the texture coordinates of the entry and exit points
    tEnter = max(tEnter, 0.0);
    vec3 entryPointNormalized = rayOrigin + rayDir * tEnter;
    vec3 exitPointNormalized = rayOrigin + rayDir * tExit;

    // Clamp to valid texture coordinates
    entryPointNormalized = clamp(entryPointNormalized, 0.0, 1.0);
    exitPointNormalized = clamp(exitPointNormalized, 0.0, 1.0);

    // Raymarch from entry to exit point
    vec3 position = entryPointNormalized;
    vec3 step = exitPointNormalized - entryPointNormalized;
    float rayLength = length(step);

    // Compute number of samples to get along the ray
    int numSamples = int(rayLength * 256.0);
    numSamples = clamp(numSamples, 1, 512);

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

        float normalizedIntensity = texel / 255.0;
        float sampleAlpha = normalizedIntensity * 0.1;

        // Front-to-back compositing
        vec3 sampleColor = vec3(1.0);
        float prevAlpha = alpha;
        alpha = alpha + (1.0 - alpha) * sampleAlpha;
        accumulatedColor += sampleColor * sampleAlpha * (1.0 - prevAlpha);

        if (alpha >= 0.99) {
            break;
        }
        position += (step / float(numSamples));
    }

    fragColor = vec4(accumulatedColor, alpha);
}
