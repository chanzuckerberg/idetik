import WebGPUShaderLibrary, { ShaderName } from "./webgpu_shader_library";
import { WebGPUGeometryBuffer } from "./webgpu_geometry_buffers";

export type PipelineKey = {
  shaderName: ShaderName;
  depthWrite: boolean;
  depthTest: boolean;
  stencil: boolean;
  cullMode: GPUCullMode;
  topology: GPUPrimitiveTopology;
  vertexAttributesStr: string;
};

type WebGPUPipeline = {
  key: PipelineKey;
  pipeline: GPURenderPipeline;
};

export default class WebGPUPipelines {
  private readonly colorFormat_: GPUTextureFormat;
  private readonly depthFormat_: GPUTextureFormat;
  private readonly device_: GPUDevice;
  private readonly pipelines_: WebGPUPipeline[];
  private readonly shaderLibrary_: WebGPUShaderLibrary;

  constructor(
    device: GPUDevice,
    shaderLibrary: WebGPUShaderLibrary,
    colorFormat: GPUTextureFormat,
    depthFormat: GPUTextureFormat
  ) {
    this.colorFormat_ = colorFormat;
    this.depthFormat_ = depthFormat;
    this.device_ = device;
    this.pipelines_ = [];
    this.shaderLibrary_ = shaderLibrary;
  }

  public get(key: PipelineKey, geometryBuffer: WebGPUGeometryBuffer) {
    const cached = this.getCachedPipeline(key);
    if (cached) return cached.pipeline;

    const shader = this.shaderLibrary_.get(key.shaderName);
    const layout = this.device_.createPipelineLayout({
      bindGroupLayouts: shader.bindGroupLayouts,
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
        module: shader.module,
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
        module: shader.module,
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

    this.pipelines_.push({ key, pipeline });

    return pipeline;
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
