import { WebGPUGeometryBuffer } from "./webgpu_geometry_buffers";

import { BlendMode } from "@/core/layer";
import { Logger } from "@/utilities/logger";

import ImageScalarU32 from "./shaders/image_scalar_u32.wgsl";
import ImageScalarI32 from "./shaders/image_scalar_i32.wgsl";
import ImageScalarF32 from "./shaders/image_scalar_f32.wgsl";

import {
  ShaderDataDefinitions,
  StructuredView,
  makeBindGroupLayoutDescriptors,
  makeShaderDataDefinitions,
  makeStructuredView,
} from "webgpu-utils";

export type PipelineKey = {
  shaderName: ShaderName;
  depthWrite: boolean;
  depthTest: boolean;
  stencil: boolean;
  blendMode: BlendMode;
  cullMode: GPUCullMode;
  topology: GPUPrimitiveTopology;
  vertexAttributesStr: string;
};

export type WebGPUPipeline = {
  key: PipelineKey;
  pipeline: GPURenderPipeline;
  uniformsView: StructuredView;
  uniformsData: Float32Array;
  layouts: {
    object: GPUBindGroupLayout;
    texture: GPUBindGroupLayout;
  };
};

export type ShaderName =
  | "image_scalar_u32"
  | "image_scalar_i32"
  | "image_scalar_f32";

type WebGPUShaderModule = {
  name: ShaderName;
  module: GPUShaderModule;
  defs: ShaderDataDefinitions;
  layouts: {
    object: GPUBindGroupLayout;
    texture: GPUBindGroupLayout;
  };
};

export default class WebGPUPipelines {
  private readonly colorFormat_: GPUTextureFormat;
  private readonly depthFormat_: GPUTextureFormat;
  private readonly device_: GPUDevice;
  private readonly pipelines_: WebGPUPipeline[];
  private readonly shaderModules_: WebGPUShaderModule[];

  constructor(
    device: GPUDevice,
    colorFormat: GPUTextureFormat,
    depthFormat: GPUTextureFormat
  ) {
    this.colorFormat_ = colorFormat;
    this.depthFormat_ = depthFormat;
    this.device_ = device;
    this.pipelines_ = [];
    this.shaderModules_ = [];
  }

  public async compileShader(name: ShaderName) {
    if (this.shaderModules_.some((s) => s.name === name)) return;

    const source = shaderSourceFromName(name);
    const module = this.device_.createShaderModule({
      code: source,
    });

    const compilationInfo = await module.getCompilationInfo();
    if (compilationInfo.messages.some((m) => m.type === "error")) {
      for (const msg of compilationInfo.messages) {
        Logger.error("WebGPUPipelines", `${msg.type}: ${msg.message}`);
      }
      throw new Error(`Failed to compile WGSL shader ${name}.wgsl`);
    }

    const defs = makeShaderDataDefinitions(source);

    const descriptors = makeBindGroupLayoutDescriptors(defs, {
      vertex: { entryPoint: "vert" },
      fragment: { entryPoint: "frag" },
    });

    const objectDescriptor = descriptors[defs.uniforms.object.group];
    const textureDescriptor = descriptors[defs.textures.texture.group];

    for (const entry of objectDescriptor.entries as GPUBindGroupLayoutEntry[]) {
      if (entry.buffer) {
        entry.buffer = { ...entry.buffer, hasDynamicOffset: true };
      }
    }

    // r32float isn't filterable without the `float32-filterable` feature.
    // Since we don't use a sampler, it's safe to use unfilterable-float
    // across all float-valued formats.
    if (name === "image_scalar_f32") {
      for (const entry of textureDescriptor.entries as GPUBindGroupLayoutEntry[]) {
        if (entry.texture) {
          entry.texture = {
            ...entry.texture,
            sampleType: "unfilterable-float",
          };
        }
      }
    }

    const layouts = {
      object: this.device_.createBindGroupLayout(objectDescriptor),
      texture: this.device_.createBindGroupLayout(textureDescriptor),
    };

    this.shaderModules_.push({ name, module, defs, layouts });
  }

  public get(key: PipelineKey, geometryBuffer: WebGPUGeometryBuffer) {
    const cached = this.getCachedPipeline(key);
    if (cached) return cached;

    const shaderModule = this.shaderModules_.find(
      (s) => s.name === key.shaderName
    );

    if (!shaderModule) {
      throw new Error(`Shader module not found`);
    }

    const depthCompare: GPUCompareFunction = key.depthTest
      ? "less-equal"
      : "always";

    const stencilFace: GPUStencilFaceState = key.stencil
      ? { compare: "equal", passOp: "increment-clamp" }
      : {};

    const pipelineDesc = {
      vertex: {
        module: shaderModule.module,
        entryPoint: "vert",
        buffers: [
          {
            attributes: geometryBuffer.attributes,
            arrayStride: geometryBuffer.geometry.strideBytes,
            stepMode: "vertex",
          },
        ],
      },
      fragment: {
        module: shaderModule.module,
        entryPoint: "frag",
        targets: [
          {
            format: this.colorFormat_,
            blend: blendStateFromMode(key.blendMode),
          },
        ],
      },
      primitive: {
        topology: key.topology,
        frontFace: "ccw",
        cullMode: key.cullMode,
      },
      depthStencil: {
        format: this.depthFormat_,
        depthWriteEnabled: key.depthWrite,
        depthCompare,
        stencilFront: stencilFace,
        stencilBack: stencilFace,
        stencilReadMask: 0xff,
        stencilWriteMask: 0xff,
      },
      multisample: { count: 4 },
    };

    const layout = this.device_.createPipelineLayout({
      bindGroupLayouts: [
        shaderModule.layouts.object,
        shaderModule.layouts.texture,
      ],
    });

    const pipeline = this.device_.createRenderPipeline({
      layout,
      ...pipelineDesc,
    } as GPURenderPipelineDescriptor);

    const uniformsView = makeStructuredView(shaderModule.defs.uniforms.object);

    const entry: WebGPUPipeline = {
      key,
      pipeline,
      uniformsView,
      uniformsData: new Float32Array(uniformsView.arrayBuffer),
      layouts: shaderModule.layouts,
    };

    this.pipelines_.push(entry);

    return entry;
  }

  private getCachedPipeline(key: PipelineKey) {
    return this.pipelines_.find(
      (p) =>
        p.key.blendMode === key.blendMode &&
        p.key.cullMode === key.cullMode &&
        p.key.depthTest === key.depthTest &&
        p.key.depthWrite === key.depthWrite &&
        p.key.shaderName === key.shaderName &&
        p.key.stencil === key.stencil &&
        p.key.topology === key.topology &&
        p.key.vertexAttributesStr === key.vertexAttributesStr
    );
  }
}

function shaderSourceFromName(name: ShaderName) {
  switch (name) {
    case "image_scalar_u32":
      return ImageScalarU32;
    case "image_scalar_i32":
      return ImageScalarI32;
    case "image_scalar_f32":
      return ImageScalarF32;
  }
}

function blendStateFromMode(mode: BlendMode): GPUBlendState | undefined {
  let srcFactor: GPUBlendFactor;
  let dstFactor: GPUBlendFactor;

  switch (mode) {
    case "none":
      return undefined;
    case "additive":
      srcFactor = "src-alpha";
      dstFactor = "one";
      break;
    case "multiply":
      srcFactor = "dst";
      dstFactor = "zero";
      break;
    case "subtractive":
      srcFactor = "zero";
      dstFactor = "one-minus-src";
      break;
    case "premultiplied":
      srcFactor = "one-minus-dst-alpha";
      dstFactor = "one";
      break;
    case "normal":
      srcFactor = "src-alpha";
      dstFactor = "one-minus-src-alpha";
      break;
  }

  const component: GPUBlendComponent = {
    srcFactor,
    dstFactor,
    operation: "add",
  };

  return { color: component, alpha: component };
}
