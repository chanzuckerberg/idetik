struct Uniforms {
  modelView: mat4x4f,
  projection: mat4x4f,
  color: vec3f,
  opacity: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vert(@location(0) aPos: vec3f) -> @builtin(position) vec4f {
  return uniforms.projection * uniforms.modelView * vec4f(aPos, 1.0);
}

@fragment
fn frag() -> @location(0) vec4f {
  return vec4f(uniforms.color, uniforms.opacity);
}
