@group(0) @binding(0) var inputTex: texture_2d<f32>;

@vertex
fn vert(@builtin(vertex_index) idx: u32) -> @builtin(position) vec4f {
  // Fullscreen triangle covering clip-space [-1, 1]^2.
  let x = f32((idx & 1u) << 2u) - 1.0;
  let y = f32((idx & 2u) << 1u) - 1.0;
  return vec4f(x, y, 0.0, 1.0);
}

@fragment
fn frag(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  return textureLoad(inputTex, vec2i(pos.xy), 0);
}
