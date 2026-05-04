import WebGPUDynamicBuffer from "./webgpu_dynamic_buffer";
import { WebGPUPipeline } from "./webgpu_pipelines";

type UniformBinding = {
  layout: GPUBindGroupLayout;
  buffer: WebGPUDynamicBuffer;
  group: GPUBindGroup;
  version: number;
};

type TextureBinding = {
  layout: GPUBindGroupLayout;
  texture: GPUTexture;
  group: GPUBindGroup;
};

const uniformsGroup = 0;
const texturesGroup = 1;

export default class WebGPUBindings {
  private readonly device_: GPUDevice;
  private readonly uniformBindings_: UniformBinding[] = [];
  private readonly textureBindings_: TextureBinding[] = [];

  constructor(device: GPUDevice) {
    this.device_ = device;
  }

  public clearUniformBindings() {
    for (const entry of this.uniformBindings_) {
      entry.buffer.clear();
    }
  }

  public setUniforms(pass: GPURenderPassEncoder, pipeline: WebGPUPipeline) {
    const layout = pipeline.layouts.uniforms;
    const data = pipeline.uniformsData;

    let entry = this.uniformBindings_.find((e) => e.layout === layout);

    if (!entry) {
      const buffer = new WebGPUDynamicBuffer(this.device_, data.byteLength);
      const group = this.createUniformsBindGroup(
        layout,
        buffer,
        data.byteLength
      );
      entry = { layout, buffer, group, version: buffer.version };
      this.uniformBindings_.push(entry);
    }

    const offset = entry.buffer.write(data);
    const bufferSizeChanged = entry.version !== entry.buffer.version;

    if (bufferSizeChanged) {
      entry.group = this.createUniformsBindGroup(
        layout,
        entry.buffer,
        data.byteLength
      );
      entry.version = entry.buffer.version;
    }

    pass.setBindGroup(uniformsGroup, entry.group, [offset]);
  }

  public setTexture(
    pass: GPURenderPassEncoder,
    pipeline: WebGPUPipeline,
    texture: GPUTexture
  ) {
    const layout = pipeline.layouts.textures;
    if (!layout) {
      throw new Error("setTexture called on pipeline without a texture layout");
    }

    let entry = this.textureBindings_.find(
      (e) => e.layout === layout && e.texture === texture
    );

    if (!entry) {
      const group = this.createTexturesBindGroup(layout, texture);
      entry = { layout, texture, group };
      this.textureBindings_.push(entry);
    }

    pass.setBindGroup(texturesGroup, entry.group);
  }

  private createUniformsBindGroup(
    layout: GPUBindGroupLayout,
    buffer: WebGPUDynamicBuffer,
    size: number
  ) {
    return this.device_.createBindGroup({
      layout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: buffer.buffer,
            size,
          },
        },
      ],
    });
  }

  private createTexturesBindGroup(
    layout: GPUBindGroupLayout,
    texture: GPUTexture
  ) {
    return this.device_.createBindGroup({
      layout,
      entries: [
        {
          binding: 0,
          resource: texture.createView(),
        },
      ],
    });
  }
}
