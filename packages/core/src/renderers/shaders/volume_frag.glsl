#version 300 es
#pragma inject_defines

precision highp float;

layout(location = 0) out vec4 fragColor;

#if defined TEXTURE_DATA_TYPE_INT
uniform mediump isampler3D ImageSampler;
#elif defined TEXTURE_DATA_TYPE_UINT
uniform mediump usampler3D ImageSampler;
#else
uniform mediump sampler3D ImageSampler;
#endif

// Transformation matrices
uniform mat4 InverseProjection;  // Clip → Camera space
uniform mat4 InverseView;        // Camera → World space
uniform mat4 WorldToVolume;      // World → Volume [0,1]³ texture coords
uniform mat4 Projection;
uniform mat4 ModelView;

// Camera
uniform vec3 CameraPosition;     // World space camera position

// Volume bounding box (world space)
uniform vec3 BoxMinWorld;
uniform vec3 BoxMaxWorld;
uniform vec3 BoxSizeWorld;

in vec2 TexCoords;
in vec3 VNormalized;

bool intersectBox(vec3 rayOrigin, vec3 rayDir, vec3 boxMin, vec3 boxMax, out float tEnter, out float tExit) {
    vec3 invDir = 1.0f / rayDir;
    vec3 t0 = (boxMin - rayOrigin) * invDir;
    vec3 t1 = (boxMax - rayOrigin) * invDir;

    vec3 tMin = min(t0, t1);
    vec3 tMax = max(t0, t1);

    tEnter = max(max(tMin.x, tMin.y), tMin.z);
    tExit = min(min(tMax.x, tMax.y), tMax.z);

    return (tExit >= tEnter) && (tExit >= 0.0f);
}

void main() {
    // vec2 ndc = TexCoords * 2.0f - 1.0f;  // [0,1] → [-1,+1]
    // vec3
    vec4 nearClip = vec4(VNormalized.xy, -1.0f, 1.0f);
    vec4 farClip = vec4(VNormalized.xy, 1.0f, 1.0f);

    // From clip space to view/camera space
    vec4 nearView = InverseProjection * nearClip;
    vec4 farView = InverseProjection * farClip;
    nearView /= nearView.w;
    farView /= farView.w;

    // From camera/view space to world space
    vec3 nearWorld = (InverseView * vec4(nearView.xyz, 1.0f)).xyz;
    vec3 farWorld = (InverseView * vec4(farView.xyz, 1.0f)).xyz;

    vec3 rayOrigin = nearWorld;
    vec3 rayDir = normalize(farWorld - nearWorld);

    float tEnter, tExit;
    bool hit = intersectBox(rayOrigin, rayDir, BoxMinWorld, BoxMaxWorld, tEnter, tExit);
    if(!hit) {
        fragColor = vec4(0.0f, 0.0f, 0.0f, 1.0f);
        return;
    }
    tEnter = max(tEnter, 0.0f);
    vec3 entryPointWorld = rayOrigin + rayDir * tEnter;
    vec3 exitPointWorld = rayOrigin + rayDir * tExit;

    // We compute the entry and exit points in volume space from the world space
    vec3 entryVolume = (WorldToVolume * vec4(entryPointWorld, 1.0f)).xyz;
    vec3 exitVolume = (WorldToVolume * vec4(exitPointWorld, 1.0f)).xyz;

    vec3 entrypointNormalized = entryVolume;
    vec3 exitpointNormalized = exitVolume;

    vec3 move = entrypointNormalized;
    vec3 step = exitpointNormalized - entrypointNormalized;

    float alpha = 0.0f;
    for(int i = 0; i < 256; i++) {
        float texel = float(texture(ImageSampler, VNormalized).r);
        float newAlpha = clamp(texel / 1000.0f, 0.0f, 1.0f);
        alpha = (1.0f - alpha) * newAlpha + alpha;
        move += (step / 255.0f);
    }
    fragColor = vec4(move.x, move.y, move.y, 1.0f);

//    float alpha = 0.0;
//     /* Will replace fixed steps and normalization with uniforms later */
//     for (int i = 0; i < 256; i++) {
//         float z = float(i) / 255.0;
//         float texel = float(texture(ImageSampler, vec3(TexCoords, z)).r);
//         float newAlpha = clamp(texel / 1000.0, 0.0, 1.0);
//         alpha = (1.0 - alpha) * newAlpha + alpha;
//     }
//     float displayValue = alpha;
//     fragColor = vec4(displayValue, displayValue, displayValue, 1.0);
}