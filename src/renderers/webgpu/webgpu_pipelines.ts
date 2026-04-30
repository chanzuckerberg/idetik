import { WebGPUGeometryBuffer } from "./webgpu_geometry_buffers";

import { BlendMode } from "@/core/layer";
import { Logger } from "@/utilities/logger";

import ImageScalarU32 from "./shaders/image_scalar_u32.wgsl";
import ImageScalarI32 from "./shaders/image_scalar_i32.wgsl";
import ImageScalarF32 from "./shaders/image_scalar_f32.wgsl";
import VolumeComputeU32 from "./shaders/volume_compute_u32.wgsl";
import VolumeComposite from "./shaders/volume_composite.wgsl";
import Wireframe from "./shaders/wireframe.wgsl";

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
    texture?: GPUBindGroupLayout;
  };
};

export type WebGPUComputePipeline = {
  pipeline: GPUComputePipeline;
  uniformsView: StructuredView;
  uniformsData: Float32Array;
  layouts: {
    object: GPUBindGroupLayout;
    texture: GPUBindGroupLayout;
    storage: GPUBindGroupLayout;
  };
};

export type WebGPUCompositePipeline = {
  pipeline: GPURenderPipeline;
  textureLayout: GPUBindGroupLayout;
};

export type ShaderName =
  | "image_scalar_u32"
  | "image_scalar_i32"
  | "image_scalar_f32"
  | "volume_compute_u32"
  | "volume_composite"
  | "wireframe";

type WebGPUShaderModule = {
  name: ShaderName;
  module: GPUShaderModule;
  defs: ShaderDataDefinitions;
  layouts: {
    object: GPUBindGroupLayout;
    texture?: GPUBindGroupLayout;
  };
};

type WebGPUComputeShaderModule = {
  name: ShaderName;
  module: GPUShaderModule;
  defs: ShaderDataDefinitions;
  layouts: {
    object: GPUBindGroupLayout;
    texture: GPUBindGroupLayout;
    storage: GPUBindGroupLayout;
  };
};

export default class WebGPUPipelines {
  private readonly colorFormat_: GPUTextureFormat;
  private readonly depthFormat_: GPUTextureFormat;
  private readonly device_: GPUDevice;
  private readonly pipelines_: WebGPUPipeline[];
  private readonly shaderModules_: WebGPUShaderModule[];
  private readonly computeModules_: WebGPUComputeShaderModule[] = [];
  private readonly computePipelines_: { name: ShaderName; entry: WebGPUComputePipeline }[] = [];
  private compositePipeline_: WebGPUCompositePipeline | null = null;

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

    const objectDescriptor = descriptors[defs.uniforms.uniforms.group];

    for (const entry of objectDescriptor.entries as GPUBindGroupLayoutEntry[]) {
      if (entry.buffer) {
        entry.buffer = { ...entry.buffer, hasDynamicOffset: true };
      }
    }

    // Pull the shader's texture group index from any one declared texture --
    // all of them share the same bind group, so a single layout covers them.
    const firstTexture = defs.textures
      ? Object.values(defs.textures)[0]
      : undefined;
    let textureLayout: GPUBindGroupLayout | undefined;
    if (firstTexture) {
      const textureDescriptor = descriptors[firstTexture.group];

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

      textureLayout = this.device_.createBindGroupLayout(textureDescriptor);
    }

    this.shaderModules_.push({
      name,
      module,
      defs,
      layouts: {
        object: this.device_.createBindGroupLayout(objectDescriptor),
        texture: textureLayout,
      },
    });
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

    const bindGroupLayouts: GPUBindGroupLayout[] = [
      shaderModule.layouts.object,
    ];
    if (shaderModule.layouts.texture) {
      bindGroupLayouts.push(shaderModule.layouts.texture);
    }

    const layout = this.device_.createPipelineLayout({ bindGroupLayouts });

    const pipeline = this.device_.createRenderPipeline({
      layout,
      ...pipelineDesc,
    } as GPURenderPipelineDescriptor);

    const uniformsView = makeStructuredView(shaderModule.defs.uniforms.uniforms);

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

  public async compileComputeShader(name: ShaderName) {
    if (this.computeModules_.some((s) => s.name === name)) return;

    const source = shaderSourceFromName(name);
    const module = this.device_.createShaderModule({ code: source });

    const compilationInfo = await module.getCompilationInfo();
    if (compilationInfo.messages.some((m) => m.type === "error")) {
      for (const msg of compilationInfo.messages) {
        Logger.error("WebGPUPipelines", `${msg.type}: ${msg.message}`);
      }
      throw new Error(`Failed to compile WGSL compute shader ${name}.wgsl`);
    }

    const defs = makeShaderDataDefinitions(source);
    const descriptors = makeBindGroupLayoutDescriptors(defs, {
      compute: { entryPoint: "main" },
    });

    const objectDescriptor = descriptors[defs.uniforms.uniforms.group];
    for (const entry of objectDescriptor.entries as GPUBindGroupLayoutEntry[]) {
      if (entry.buffer) {
        entry.buffer = { ...entry.buffer, hasDynamicOffset: true };
      }
    }

    const firstTexture = defs.textures
      ? Object.values(defs.textures)[0]
      : undefined;
    if (!firstTexture) {
      throw new Error(`Compute shader ${name} must declare textures at group 1`);
    }
    const textureDescriptor = descriptors[firstTexture.group];

    const firstStorage = defs.storageTextures
      ? Object.values(defs.storageTextures)[0]
      : undefined;
    if (!firstStorage) {
      throw new Error(
        `Compute shader ${name} must declare a storage texture at group 2`
      );
    }
    const storageDescriptor = descriptors[firstStorage.group];

    this.computeModules_.push({
      name,
      module,
      defs,
      layouts: {
        object: this.device_.createBindGroupLayout(objectDescriptor),
        texture: this.device_.createBindGroupLayout(textureDescriptor),
        storage: this.device_.createBindGroupLayout(storageDescriptor),
      },
    });
  }

  public getCompute(name: ShaderName): WebGPUComputePipeline {
    const cached = this.computePipelines_.find((p) => p.name === name);
    if (cached) return cached.entry;

    const shaderModule = this.computeModules_.find((s) => s.name === name);
    if (!shaderModule) {
      throw new Error(`Compute shader module ${name} not compiled`);
    }

    const layout = this.device_.createPipelineLayout({
      bindGroupLayouts: [
        shaderModule.layouts.object,
        shaderModule.layouts.texture,
        shaderModule.layouts.storage,
      ],
    });

    const pipeline = this.device_.createComputePipeline({
      layout,
      compute: { module: shaderModule.module, entryPoint: "main" },
    });

    const uniformsView = makeStructuredView(shaderModule.defs.uniforms.uniforms);

    const entry: WebGPUComputePipeline = {
      pipeline,
      uniformsView,
      uniformsData: new Float32Array(uniformsView.arrayBuffer),
      layouts: shaderModule.layouts,
    };

    this.computePipelines_.push({ name, entry });
    return entry;
  }

  // The composite shader is a one-off fullscreen blit; it has no uniforms,
  // no vertex buffer, and a single sampled texture binding. It doesn't fit
  // the general render-shader compile path, so it lives here on its own.
  public async compileComposite(targetFormat: GPUTextureFormat) {
    if (this.compositePipeline_) return;

    const source = shaderSourceFromName("volume_composite");
    const module = this.device_.createShaderModule({ code: source });

    const compilationInfo = await module.getCompilationInfo();
    if (compilationInfo.messages.some((m) => m.type === "error")) {
      for (const msg of compilationInfo.messages) {
        Logger.error("WebGPUPipelines", `${msg.type}: ${msg.message}`);
      }
      throw new Error("Failed to compile WGSL shader volume_composite.wgsl");
    }

    const textureLayout = this.device_.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "unfilterable-float", viewDimension: "2d" },
        },
      ],
    });

    const layout = this.device_.createPipelineLayout({
      bindGroupLayouts: [textureLayout],
    });

    const pipeline = this.device_.createRenderPipeline({
      layout,
      vertex: { module, entryPoint: "vert" },
      fragment: {
        module,
        entryPoint: "frag",
        targets: [
          {
            format: targetFormat,
            blend: blendStateFromMode("premultiplied"),
          },
        ],
      },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: {
        format: this.depthFormat_,
        depthWriteEnabled: false,
        depthCompare: "always",
      },
      multisample: { count: 4 },
    });

    this.compositePipeline_ = { pipeline, textureLayout };
  }

  public getComposite(): WebGPUCompositePipeline {
    if (!this.compositePipeline_) {
      throw new Error("Composite pipeline not compiled");
    }
    return this.compositePipeline_;
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
    case "volume_compute_u32":
      return VolumeComputeU32;
    case "volume_composite":
      return VolumeComposite;
    case "wireframe":
      return Wireframe;
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
