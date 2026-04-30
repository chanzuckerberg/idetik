struct Varyings {
  @builtin(position) position: vec4f,
  @location(0) position_model: vec3f,
};

struct Uniforms {
  modelView: mat4x4f,
  projection: mat4x4f,
  cameraPositionModel: vec3f,
  voxelScale: vec3f,
  visible: vec4f,
  valueOffset: vec4f,
  valueScale: vec4f,
  colors: array<vec4<f32>, 4>,
  relativeStepSize: f32,
  opacityMultiplier: f32,
  earlyTerminationAlpha: f32,
  debugShowDegenerateRays: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(1) @binding(0) var channel0: texture_3d<u32>;
@group(1) @binding(1) var channel1: texture_3d<u32>;
@group(1) @binding(2) var channel2: texture_3d<u32>;
@group(1) @binding(3) var channel3: texture_3d<u32>;

const BBOX_MIN = vec3f(-0.5);
const BBOX_MAX = vec3f(0.5);

@vertex
fn vert(@location(0) aPos: vec3f) -> Varyings {
  var out = Varyings();
  out.position = uniforms.projection * uniforms.modelView * vec4f(aPos, 1.0);
  out.position_model = aPos;
  return out;
}

fn rayBoxIntersect(origin: vec3f, dir: vec3f) -> vec2f {
  let inv = 1.0 / dir;
  let t0 = (BBOX_MIN - origin) * inv;
  let t1 = (BBOX_MAX - origin) * inv;
  let tminV = min(t0, t1);
  let tmaxV = max(t0, t1);
  var tEnter = max(max(tminV.x, tminV.y), tminV.z);
  let tExit = min(min(tmaxV.x, tmaxV.y), tmaxV.z);
  tEnter = max(0.0, tEnter);
  return vec2f(tEnter, max(tEnter, tExit));
}

fn loadVoxel(tex: texture_3d<u32>, uvw: vec3f) -> f32 {
  let dims = vec3i(textureDimensions(tex));
  let coords = clamp(vec3i(uvw * vec3f(dims)), vec3i(0), dims - vec3i(1));
  return f32(textureLoad(tex, coords, 0).r);
}

fn sampleChannels(uvw: vec3f) -> vec4f {
  var c = vec4f(0.0);
  if (uniforms.visible.x > 0.0) { c.x = loadVoxel(channel0, uvw); }
  if (uniforms.visible.y > 0.0) { c.y = loadVoxel(channel1, uvw); }
  if (uniforms.visible.z > 0.0) { c.z = loadVoxel(channel2, uvw); }
  if (uniforms.visible.w > 0.0) { c.w = loadVoxel(channel3, uvw); }
  return (c + uniforms.valueOffset) * uniforms.valueScale;
}

fn anyTextureSize() -> vec3f {
  if (uniforms.visible.x > 0.0) { return vec3f(textureDimensions(channel0)); }
  if (uniforms.visible.y > 0.0) { return vec3f(textureDimensions(channel1)); }
  if (uniforms.visible.z > 0.0) { return vec3f(textureDimensions(channel2)); }
  if (uniforms.visible.w > 0.0) { return vec3f(textureDimensions(channel3)); }
  return vec3f(1.0);
}

@fragment
fn frag(in: Varyings) -> @location(0) vec4f {
  let rayDir = normalize(in.position_model - uniforms.cameraPositionModel);
  let isect = rayBoxIntersect(uniforms.cameraPositionModel, rayDir);
  let tEnter = isect.x;
  let tExit = isect.y;

  if (uniforms.debugShowDegenerateRays > 0.0 && tEnter == tExit) {
    return vec4f(1.0, 0.0, 0.0, 1.0);
  }

  let entry = clamp(
    uniforms.cameraPositionModel + rayDir * tEnter + vec3f(0.5),
    vec3f(0.0), vec3f(1.0)
  );
  let exit = clamp(
    uniforms.cameraPositionModel + rayDir * tExit + vec3f(0.5),
    vec3f(0.0), vec3f(1.0)
  );

  let rayWithinModel = exit - entry;
  let texSize = anyTextureSize();
  let rayInVoxels = rayWithinModel * texSize;
  let rayLenInVoxels = length(rayInVoxels);
  let numSamples = max(i32(ceil(rayLenInVoxels / uniforms.relativeStepSize)), 1);
  let stepIncrement = rayWithinModel / f32(numSamples);

  // World-space step length is used to keep brightness constant for
  // anisotropic voxels regardless of viewing angle.
  let stepInWorld = stepIncrement * texSize * uniforms.voxelScale;
  let intensityScale = uniforms.opacityMultiplier * length(stepInWorld);

  var pos = entry;
  var accum = vec4f(0.0);

  for (var i = 0; i < numSamples; i = i + 1) {
    if (accum.a >= uniforms.earlyTerminationAlpha) { break; }

    let samples = sampleChannels(pos);

    if (uniforms.visible.x > 0.0 && samples.x != 0.0) {
      let a = clamp(samples.x * intensityScale, 0.0, 1.0);
      let blended = (1.0 - accum.a) * a;
      accum = accum + vec4f(uniforms.colors[0].rgb * blended, blended);
    }
    if (uniforms.visible.y > 0.0 && samples.y != 0.0) {
      let a = clamp(samples.y * intensityScale, 0.0, 1.0);
      let blended = (1.0 - accum.a) * a;
      accum = accum + vec4f(uniforms.colors[1].rgb * blended, blended);
    }
    if (uniforms.visible.z > 0.0 && samples.z != 0.0) {
      let a = clamp(samples.z * intensityScale, 0.0, 1.0);
      let blended = (1.0 - accum.a) * a;
      accum = accum + vec4f(uniforms.colors[2].rgb * blended, blended);
    }
    if (uniforms.visible.w > 0.0 && samples.w != 0.0) {
      let a = clamp(samples.w * intensityScale, 0.0, 1.0);
      let blended = (1.0 - accum.a) * a;
      accum = accum + vec4f(uniforms.colors[3].rgb * blended, blended);
    }

    pos = pos + stepIncrement;
  }

  return accum;
}
