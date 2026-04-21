import { WebGPUGeometryBuffer } from "./webgpu_geometry_buffers";
import { ImageScalarUnsignedShader } from "./shaders/image_scalar_unsigned";
import { Logger } from "@/utilities/logger";

export type PipelineKey = {
  shaderName: ShaderName;
  depthWrite: boolean;
  depthTest: boolean;
  stencil: boolean;
  cullMode: GPUCullMode;
  topology: GPUPrimitiveTopology;
  vertexAttributesStr: string;
};

export type WebGPUBindGroupLayout = {
  group: number;
  layout: GPUBindGroupLayout;
};

type ShaderName = "image";

type WebGPUPipeline = {
  key: PipelineKey;
  pipeline: GPURenderPipeline;
  uniformLayout: WebGPUBindGroupLayout;
  textureLayout: WebGPUBindGroupLayout;
};

type WebGPUShaderModule = {
  name: ShaderName;
  module: GPUShaderModule;
};

export default class WebGPUPipelines {
  private readonly colorFormat_: GPUTextureFormat;
  private readonly depthFormat_: GPUTextureFormat;
  private readonly device_: GPUDevice;
  private readonly pipelines_: WebGPUPipeline[];
  private readonly shaderModules_: WebGPUShaderModule[];
  private readonly frameLayout_: WebGPUBindGroupLayout;
  private readonly layerLayout_: WebGPUBindGroupLayout;

  static readonly frameUniformSize = 64;
  static readonly layerUniformSize = 4;

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

    this.frameLayout_ = {
      group: 0,
      layout: this.device_.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: { hasDynamicOffset: true },
          },
        ],
      }),
    };

    this.layerLayout_ = {
      group: 1,
      layout: this.device_.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: { hasDynamicOffset: true },
          },
        ],
      }),
    };
  }

  public async compileShader(name: ShaderName) {
    if (this.shaderModules_.some((s) => s.name === name)) return;

    const shader = shaderFromName(name);
    const module = this.device_.createShaderModule({
      code: shader.source,
    });

    const compilationInfo = await module.getCompilationInfo();
    if (compilationInfo.messages.some((m) => m.type === "error")) {
      for (const msg of compilationInfo.messages) {
        Logger.error("WebGPUPipelines", `${msg.type}: ${msg.message}`);
      }
      throw new Error(`Failed to compile WGSL shader ${name}.wgsl`);
    }

    this.shaderModules_.push({ name, module });
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

    const shader = shaderFromName(key.shaderName);

    const uniformLayout = this.device_.createBindGroupLayout({
      entries: shader.uniforms.entries,
    });

    const textureLayout = this.device_.createBindGroupLayout({
      entries: shader.textures,
    });

    const layout = this.device_.createPipelineLayout({
      bindGroupLayouts: [
        this.frameLayout_.layout,
        this.layerLayout_.layout,
        uniformLayout,
        textureLayout,
      ],
    });

    const depthCompare: GPUCompareFunction = key.depthTest
      ? "less-equal"
      : "always";

    const stencilFace: GPUStencilFaceState = key.stencil
      ? { compare: "always", passOp: "replace" }
      : {};

    const pipeline = this.device_.createRenderPipeline({
      layout,
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
    });

    const entry: WebGPUPipeline = {
      key,
      pipeline,
      uniformLayout: { group: 2, layout: uniformLayout },
      textureLayout: { group: 3, layout: textureLayout },
    };
    this.pipelines_.push(entry);

    return entry;
  }

  public get frameLayout() {
    return this.frameLayout_;
  }

  public get layerLayout() {
    return this.layerLayout_;
  }

  public static packFrameUniforms(target: Float32Array, projection: Float32Array) {
    target.set(projection, 0);
  }

  public static packLayerUniforms(target: Float32Array, opacity: number) {
    target[0] = opacity;
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

function shaderFromName(name: ShaderName) {
  switch (name) {
    case "image":
      return ImageScalarUnsignedShader;
  }
}
