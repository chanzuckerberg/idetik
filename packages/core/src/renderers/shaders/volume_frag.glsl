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
uniform mat4 Projection;
uniform mat4 ModelView;
uniform mat4 InverseModelViewProjection;

// Volume bounding box (model space)
uniform vec3 BoxSize;

const vec3 boxMin = vec3(-0.00);
const vec3 boxMax = vec3(1.00);

in vec2 TexCoords;
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

// void main() {
//     vec2 normalizedXY = clamp(NormalizedPosition.xy / NormalizedPosition.w, -1.0, 1.0);
//     // Get the near and far points in model space, then normalized to unit box space [0, 1]
//     vec4 nearPointHomogeneous = InverseModelViewProjection * vec4(normalizedXY, -1.0, 1.0);
//     vec4 farPointHomogeneous = InverseModelViewProjection * vec4(normalizedXY, 1.0, 1.0);
//     vec3 nearPoint = (nearPointHomogeneous.xyz / nearPointHomogeneous.w / BoxSize) + 0.5;
//     vec3 farPoint = (farPointHomogeneous.xyz / farPointHomogeneous.w / BoxSize) + 0.5;

//     // Find the start and end of the ray within the volume from the near point to the far point
//     float tEnter, tExit;
//     vec3 rayOrigin = nearPoint;
//     vec3 rayDir = normalize(farPoint - nearPoint);
//     bool hit = intersectBox(rayOrigin, rayDir, boxMin, boxMax, tEnter, tExit);

//     // We shouldn't have a miss, but just in case keeping for debugging for now
//     if (!hit) {
//         // fragColor = vec4(rayOrigin.x * 1.0, 0.0, 0.0, 1.0);
//         return;
//     }

//     // Find the texture coordinates of the entry and exit points
//     tEnter = max(tEnter, 0.0);
//     vec3 entryPointNormalized = rayOrigin + rayDir * tEnter;
//     vec3 exitPointNormalized = rayOrigin + rayDir * tExit;

//     // Raymarch from entry to exit point
//     vec3 position = entryPointNormalized;
//     vec3 step = exitPointNormalized - entryPointNormalized;
//     vec3 accumulatedColor = vec3(0.0);
//     float alpha = 0.0;

//     for (int i = 0; i < 256; i++) {
//         vec4 sampledData;

// #if defined(TEXTURE_DATA_TYPE_INT)
//         ivec4 rawData = texture(ImageSampler, position);
//         sampledData = vec4(rawData) ;
// #elif defined(TEXTURE_DATA_TYPE_UINT)
//         uvec4 rawData = texture(ImageSampler, position);
//         sampledData = vec4(rawData);
// #else
//         sampledData = texture(ImageSampler, position);
// #endif

//         float texel = sampledData.r;

//         float newAlpha = clamp(texel / 5000.0, 0.0, 1.0);
//         float prevAlpha = alpha;
//         alpha = (1.0 - alpha) * newAlpha + alpha;

//         vec3 sampleColor = vec3(1.0-texel);
//         accumulatedColor += sampleColor * (alpha - prevAlpha);

//         if (alpha >= 0.99)
//             break;
//         position += (step / 255.0);
//     }

//     fragColor = vec4(accumulatedColor, alpha);

// }

void main() {
    const vec3 boxMin = vec3(-0.005);
    const vec3 boxMax = vec3(1.005);

    vec2 normalizedXY = NormalizedPosition.xy / NormalizedPosition.w;
    // Get the near and far points in model space, then normalized to unit box space [0, 1]
    vec4 nearPointHomogeneous = InverseModelViewProjection * vec4(normalizedXY, -1.0, 1.0);
    vec4 farPointHomogeneous = InverseModelViewProjection * vec4(normalizedXY, 1.0, 1.0);
    vec3 nearPoint = (nearPointHomogeneous.xyz / nearPointHomogeneous.w / BoxSize) + 0.5;
    vec3 farPoint = (farPointHomogeneous.xyz / farPointHomogeneous.w / BoxSize) + 0.5;

    // Find the start and end of the ray within the volume from the near point to the far point
    float tEnter, tExit;
    vec3 rayOrigin = nearPoint;
    vec3 rayDir = normalize(farPoint - nearPoint);
    nearPoint = clamp(nearPoint, vec3(0.0), vec3(1.0));
    farPoint = clamp(farPoint, vec3(0.0), vec3(1.0));

    bool hit = intersectBox(rayOrigin, rayDir, boxMin, boxMax, tEnter, tExit);

    // We shouldn't have a miss, but just in case keeping for debugging for now
    if (!hit) {
        fragColor = vec4(1.0, 0.0, 0.0, 1.0);
        return;
    }

    // Find the texture coordinates of the entry and exit points
    tEnter = max(tEnter, 0.0);
    vec3 entryPointNormalized = rayOrigin + rayDir * tEnter;
    vec3 exitPointNormalized = rayOrigin + rayDir * tExit;

    // Raymarch from entry to exit point
    vec3 position = entryPointNormalized;

    vec3 step = exitPointNormalized - entryPointNormalized;
    vec4 accumulatedColor = vec4(0.0);
    int nbSteps = 255;
    for (int i = 0; i < nbSteps; i++) {
        vec4 sampledData;
        // vec3 safePos = clamp(position, 0.0 + 0.5 / float(nbSteps), 1.0 - 0.5 / float(nbSteps));
#if defined(TEXTURE_DATA_TYPE_INT)
        ivec4 rawData = texture(ImageSampler, position);
        sampledData = vec4(rawData) / 255.0; // normalize to 0–1 range
#elif defined(TEXTURE_DATA_TYPE_UINT)
        uvec4 rawData = texture(ImageSampler, position);
        sampledData = vec4(rawData) / 255.0; // normalize to 0–1 range
#else
        sampledData = texture(ImageSampler, position); // already vec4
#endif

        float intensity = sampledData.r;
        vec3 color = vec3(intensity);
        accumulatedColor.rgb += (color * 0.04) * (1.0 - accumulatedColor.a);

        accumulatedColor.a += sampledData.a * (1.0 - accumulatedColor.a);
        if (accumulatedColor.a >= 0.99)
            break;

        position += (step / float(nbSteps));
    }

    fragColor = vec4(accumulatedColor.rgb * accumulatedColor.a, accumulatedColor.a);
}