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
uniform mat4 Projection;
uniform mat4 ModelView;
uniform mat4 InverseModelViewProjection;

// Volume bounding box (world space)
uniform vec3 BoxSize;

in vec2 TexCoords;
in vec4 NormalizedPosition;

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
    vec3 BoxMin = vec3(0.0f, 0.0f, 0.0f);
    vec3 BoxMax = vec3(1.0f, 1.0f, 1.0f);
    bool hit = intersectBox(rayOrigin, rayDir, BoxMin, BoxMax, tEnter, tExit);

    // We shouldn't have a miss, but just in case keeping for debugging for now
    if(!hit) {
        fragColor = vec4(1.0f, 0.0f, 0.0f, 1.0f);
        return;
    }

    // Find the texture coordinates of the entry and exit points
    tEnter = max(tEnter, 0.0f);
    vec3 entryPointNormalized = rayOrigin + rayDir * tEnter;
    vec3 exitPointNormalized = rayOrigin + rayDir * tExit;

    // Raymarch from entry to exit point
    vec3 move = entryPointNormalized;
    vec3 step = exitPointNormalized - entryPointNormalized;
    float alpha = 0.0f;
    for(int i = 0; i < 256; i++) {
        float texel = float(texture(ImageSampler, move).r);
        float newAlpha = clamp(texel / 1000.0f, 0.0f, 1.0f);
        alpha = (1.0f - alpha) * newAlpha + alpha;
        move += (step / 255.0f);
    }
    fragColor = vec4(alpha, alpha, alpha, 1.0f);
}
