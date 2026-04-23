import { WebGPUGeometryBuffer } from "./webgpu_geometry_buffers";

import { Logger } from "@/utilities/logger";

import ImageScalarUnsigned from "./shaders/image_scalar_unsigned.wgsl";

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

type ShaderName = "image_scalar_unsigned";

type WebGPUShaderModule = {
  name: ShaderName;
  module: GPUShaderModule;
  defs: ShaderDataDefinitions;
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

    this.shaderModules_.push({ name, module, defs });
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
      ? { compare: "always", passOp: "replace" }
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
        targets: [{ format: this.colorFormat_ }],
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
        stencilWriteMask: key.stencil ? 0xff : 0x00,
      },
    };

    const definitions = shaderModule.defs;
    const descriptors = makeBindGroupLayoutDescriptors(
      definitions,
      pipelineDesc
    );

    const objectDescriptor = descriptors[definitions.uniforms.object.group];
    const textureDescriptor = descriptors[definitions.textures.texture.group];

    for (const entry of objectDescriptor.entries as GPUBindGroupLayoutEntry[]) {
      if (entry.buffer) {
        entry.buffer = { ...entry.buffer, hasDynamicOffset: true };
      }
    }

    const objectLayout = this.device_.createBindGroupLayout(objectDescriptor);
    const textureLayout = this.device_.createBindGroupLayout(textureDescriptor);

    const layout = this.device_.createPipelineLayout({
      bindGroupLayouts: [objectLayout, textureLayout],
    });

    const pipeline = this.device_.createRenderPipeline({
      layout,
      ...pipelineDesc,
    } as GPURenderPipelineDescriptor);

    const uniformsView = makeStructuredView(definitions.uniforms.object);

    const entry: WebGPUPipeline = {
      key,
      pipeline,
      uniformsView,
      uniformsData: new Float32Array(uniformsView.arrayBuffer),
      layouts: {
        object: objectLayout,
        texture: textureLayout,
      },
    };

    this.pipelines_.push(entry);

    return entry;
  }

  private getCachedPipeline(key: PipelineKey) {
    return this.pipelines_.find(
      (p) =>
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
    case "image_scalar_unsigned":
      return ImageScalarUnsigned;
  }
}
