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

// --- Group 2: Object - per shader --- //

export type PassthroughObjectUniforms = {
  modelView: Float32Array;
};

export const PassthroughObjectDef: UniformDef<PassthroughObjectUniforms> = {
  size: 64,
  entries: [
    {
      binding: 0,
      visibility: GPUShaderStage.VERTEX,
      buffer: { hasDynamicOffset: true },
    },
  ],
  pack(target, offset, data) {
    target.set(data.modelView, offset);
  },
};
