#version 300 es
#pragma inject_defines
precision highp float;

layout (location = 0) out vec4 fragColor;

// This shader could be optimised by creating four separate shader variants
#if defined TEXTURE_DATA_TYPE_INT
precision mediump isampler3D;
uniform isampler3D Channel0Sampler;
uniform isampler3D Channel1Sampler;
uniform isampler3D Channel2Sampler;
uniform isampler3D Channel3Sampler;
#elif defined TEXTURE_DATA_TYPE_UINT
precision mediump usampler3D;
uniform usampler3D Channel0Sampler;
uniform usampler3D Channel1Sampler;
uniform usampler3D Channel2Sampler;
uniform usampler3D Channel3Sampler;
#else
precision mediump sampler3D;
uniform sampler3D Channel0Sampler;
uniform sampler3D Channel1Sampler;
uniform sampler3D Channel2Sampler;
uniform sampler3D Channel3Sampler;
#endif

uniform highp vec3 CameraPositionModel;
uniform vec3 VoxelScale;
in highp vec3 PositionModel;

// The bounding box in model space is normalized to -0.5 to 0.5
vec3 boundingboxMin = vec3(-0.50);
vec3 boundingboxMax = vec3(0.50);

// Volume rendering parameters
uniform bool DebugShowDegenerateRays;
uniform float RelativeStepSize;
uniform float OpacityMultiplier;
uniform float EarlyTerminationAlpha;

// Multi-channel support (max 4 channels, could support more with arrays if needed)
uniform vec4 Visible;
uniform vec4 ValueOffset;
uniform vec4 ValueScale;
uniform vec3 Color[4];

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

// Returns channels in .xyzw (missing channels are 0)
vec4 sampleChannels(vec3 uvw) {
  vec4 c = vec4(0.0);

  if (bool(Visible.x)) c.x = float(texture(Channel0Sampler, uvw).r);
  if (bool(Visible.y)) c.y = float(texture(Channel1Sampler, uvw).r);
  if (bool(Visible.z)) c.z = float(texture(Channel2Sampler, uvw).r);
  if (bool(Visible.w)) c.w = float(texture(Channel3Sampler, uvw).r);

  return (c + ValueOffset) * ValueScale;
}

vec3 getTextureSize() {
    if (bool(Visible.x)) return vec3(textureSize(Channel0Sampler, 0));
    else if (bool(Visible.y)) return vec3(textureSize(Channel1Sampler, 0));
    else if (bool(Visible.z)) return vec3(textureSize(Channel2Sampler, 0));
    else if (bool(Visible.w)) return vec3(textureSize(Channel3Sampler, 0));
    return vec3(1.0); // Ideally at least one channel should be visible
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
    vec3 rayWithinModel = exitPoint - entryPoint;

    // Get texture dimensions and convert ray to voxel space
    vec3 textureSize = getTextureSize();
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
    float intensityScale = OpacityMultiplier * worldSpaceStepSize;

    // Step 3 - perform the ray marching and compositing in front to back order
    vec3 position = entryPoint;
    vec4 accumulatedColor = vec4(0.0);

    vec3 sampleColor = vec3(0.0);
    float sampleAlpha, blendedSampleAlpha;
    for (int i = 0; i < numSamples && accumulatedColor.a < EarlyTerminationAlpha; i++) {

        vec4 sampleValues = sampleChannels(position);
        // Combine color per channel
        for (int ch = 0; ch < 4; ch++) {
            if (!bool(Visible[ch]) || sampleValues[ch] == 0.0) continue;
            sampleColor = Color[ch];
            sampleAlpha = clamp(sampleValues[ch] * intensityScale, 0.0, 1.0);
            blendedSampleAlpha = (1.0 - accumulatedColor.a) * sampleAlpha;

            // Front-to-back compositing
            accumulatedColor.a += blendedSampleAlpha;
            accumulatedColor.rgb += sampleColor * blendedSampleAlpha;
        }

        position += stepIncrement;
    }

    fragColor = accumulatedColor;
}
