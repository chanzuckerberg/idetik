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

// Volume rendering parameters
uniform bool ShowHitMisses;
uniform float SampleDensity;
uniform float MaxIntensity;
uniform float OpacityScale;
uniform vec3 VolumeColor;
uniform float AlphaThreshold;

// Transformation matrix
uniform highp mat4 ModelView, InverseModelView;
uniform highp vec3 CameraPositionModel;

// Ray origin position from the vertex shader
in highp vec3 RayOriginModel;

float findBoxEnd(vec3 rayOrigin, vec3 rayDir) {
    // Remove 0 parts of the ray direction to avoid division by zero
    vec3 safeRayDir;
    safeRayDir.x = (rayDir.x == 0.0) ? 1e-6 : rayDir.x;
    safeRayDir.y = (rayDir.y == 0.0) ? 1e-6 : rayDir.y;
    safeRayDir.z = (rayDir.z == 0.0) ? 1e-6 : rayDir.z; 
    vec3 invDir = 1.0 / safeRayDir;
    // The bbox is normalized already, bounds are 0.0 to 1.0
    vec3 t0 = rayOrigin * invDir;
    vec3 t1 = (1.0 - rayOrigin) * invDir;

    vec3 tMax = max(t0, t1);
    float tExit = min(min(tMax.x, tMax.y), tMax.z);
    return tExit;
}

void main() {
    // Normalize positions from [-0.5, 0.5] to [0, 1]
    vec3 normalizedCameraPosModel = CameraPositionModel.xyz + 0.5;
    vec3 exitPointModel = RayOriginModel + 0.5;

    // The ray in model space goes from the point on the back face to the camera
    vec3 RayDirModel = normalize(normalizedCameraPosModel.xyz - exitPointModel.xyz);

    // The exit point is the start of the ray because we are rendering back faces
    float tExit = findBoxEnd(RayOriginModel, RayDirModel);
    bool emptyRay = tExit < 0.0;
    if (emptyRay) {
        discard;
    }
    vec3 entryPointModel = clamp(RayOriginModel + RayDirModel * tExit, 0.0, 1.0);

    // Calculate the number of samples based on the length of the ray
    vec3 rayWithinModel = exitPointModel - entryPointModel;
    float rayLength = length(rayWithinModel);
    int numSamples = max(int(ceil(rayLength * SampleDensity)), 1);
    vec3 stepIncrement = rayWithinModel / float(numSamples);

    // Later replace by an invlerp, but overall provides a way to map the incoming
    // sampled texture value to an alpha value
    float intensityScale = (1.0 / MaxIntensity) * OpacityScale;

    // Front-to-back compositing variables
    vec3 position = entryPointModel;
    vec4 accumulatedColor = vec4(0.0);
    float sampledData;
    float sampleAlpha;
    float blendedSampleAlpha;

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
