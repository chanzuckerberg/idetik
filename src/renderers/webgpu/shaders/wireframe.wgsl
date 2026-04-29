struct ObjectUniforms {
  modelView: mat4x4f,
  projection: mat4x4f,
  color: vec3f,
  opacity: f32,
};

@group(0) @binding(0) var<uniform> object: ObjectUniforms;

@vertex
fn vert(@location(0) aPos: vec3f) -> @builtin(position) vec4f {
  return object.projection * object.modelView * vec4f(aPos, 1.0);
}

@fragment
fn frag() -> @location(0) vec4f {
  return vec4f(object.color, object.opacity);
}
