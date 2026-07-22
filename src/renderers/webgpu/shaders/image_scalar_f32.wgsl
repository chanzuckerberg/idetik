struct Varyings {
  @builtin(position) position: vec4f,
  @location(0) texCoords: vec3f,
};

struct Uniforms {
  modelView: mat4x4f,
  projection: mat4x4f,
  model: mat4x4f,
  worldToTexCoord: mat4x4f,
  color: vec3f,
  opacity: f32,
  valueOffset: f32,
  valueScale: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(1) @binding(0) var texture: texture_3d<f32>;

@vertex
fn vert(
  @location(0) aPos: vec3f,
  // @location(1) is reserved for normals, unused here
) -> Varyings {
  var out = Varyings();
  out.position = uniforms.projection * uniforms.modelView * vec4f(aPos, 1.0);
  out.texCoords = (uniforms.worldToTexCoord * uniforms.model * vec4f(aPos, 1.0)).xyz;
  return out;
}

@fragment
fn frag(in: Varyings) -> @location(0) vec4f {
  let dims = textureDimensions(texture);
  let scaled = clamp(in.texCoords, vec3f(0.0), vec3f(1.0)) * vec3f(dims);
  let texelCoords = min(vec3u(scaled), dims - vec3u(1u));
  let texel = f32(textureLoad(texture, texelCoords, 0).r);
  let value = (texel + uniforms.valueOffset) * uniforms.valueScale;
  return vec4f(value * uniforms.color, uniforms.opacity);
}
