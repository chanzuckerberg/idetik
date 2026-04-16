export type UniformDef<T> = {
  size: number;
  entries: GPUBindGroupLayoutEntry[];
  pack(target: Float32Array, offset: number, values: T): void;
};

// --- Group 0: Frame - shared across all shaders --- //

export type FrameUniforms = {
  projection: Float32Array;
};

export const FrameUniformsDef: UniformDef<FrameUniforms> = {
  size: 64,
  entries: [
    {
      binding: 0,
      visibility: GPUShaderStage.VERTEX,
      buffer: { hasDynamicOffset: true },
    },
  ],
  pack(target, offset, data) {
    target.set(data.projection, offset);
  },
};

// --- Group 1: Layer - shared across all shaders --- //

export type LayerUniforms = {
  opacity: number;
};

export const LayerUniformsDef: UniformDef<LayerUniforms> = {
  size: 4,
  entries: [
    {
      binding: 0,
      visibility: GPUShaderStage.FRAGMENT,
      buffer: { hasDynamicOffset: true },
    },
  ],
  pack(target, offset, data) {
    target[offset] = data.opacity;
  },
};

// --- Group 2: Object uniforms - per shader --- //

export type ImageObjectUniforms = {
  modelView: Float32Array;
  color: Float32Array;
  valueOffset: number;
  valueScale: number;
};

export const ImageUniformDefs: UniformDef<ImageObjectUniforms> = {
  size: 96,
  entries: [
    {
      binding: 0,
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer: { hasDynamicOffset: true },
    },
  ],
  pack(target, offset, data) {
    target.set(data.modelView, offset);
    target.set(data.color, offset + 16);
    target[offset + 20] = data.valueOffset;
    target[offset + 21] = data.valueScale;
  },
};

// --- Group 3: Object textures - per shader --- //

export const ImageTextureDefs: GPUBindGroupLayoutEntry[] = [
  { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
];
