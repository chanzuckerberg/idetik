export const LayerUniforms = /* wgsl */ `
  struct LayerUniforms {
    opacity: f32,
  };

  @group(1) @binding(0) var<uniform> layer: LayerUniforms;
`;
