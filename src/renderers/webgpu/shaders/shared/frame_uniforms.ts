export const FrameUniforms = /* wgsl */ `
  struct FrameUniforms {
    projection: mat4x4f,
  };

  @group(0) @binding(0) var<uniform> frame: FrameUniforms;
`;
