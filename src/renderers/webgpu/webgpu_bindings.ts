import WebGPUDynamicBuffer from "./webgpu_dynamic_buffer";
import { WebGPUPipeline } from "./webgpu_pipelines";

type UniformEntry = {
  layout: GPUBindGroupLayout;
  buffer: WebGPUDynamicBuffer;
  group: GPUBindGroup;
  version: number;
};

type TextureEntry = {
  layout: GPUBindGroupLayout;
  texture: GPUTexture;
  group: GPUBindGroup;
};

export default class WebGPUBindings {
  private readonly device_: GPUDevice;
  private readonly uniformEntries_: UniformEntry[] = [];
  private readonly textureEntries_: TextureEntry[] = [];

  constructor(device: GPUDevice) {
    this.device_ = device;
  }

  public clear() {
    for (const entry of this.uniformEntries_) {
      entry.buffer.clear();
    }
  }

  public setUniforms(pass: GPURenderPassEncoder, pipeline: WebGPUPipeline) {
    const layout = pipeline.layouts.object;
    const data = pipeline.uniformsData;

    let entry = this.uniformEntries_.find((e) => e.layout === layout);

    if (!entry) {
      const buffer = new WebGPUDynamicBuffer(this.device_, data.byteLength);
      const group = this.createUniformBindGroup(
        layout,
        buffer,
        data.byteLength
      );
      entry = { layout, buffer, group, version: buffer.version };
      this.uniformEntries_.push(entry);
    }

    const offset = entry.buffer.write(data);

    if (entry.version !== entry.buffer.version) {
      entry.group = this.createUniformBindGroup(
        layout,
        entry.buffer,
        data.byteLength
      );
      entry.version = entry.buffer.version;
    }

    pass.setBindGroup(0, entry.group, [offset]);
  }

  public setTexture(
    pass: GPURenderPassEncoder,
    pipeline: WebGPUPipeline,
    texture: GPUTexture
  ) {
    const layout = pipeline.layouts.texture;

    let entry = this.textureEntries_.find(
      (e) => e.layout === layout && e.texture === texture
    );

    if (!entry) {
      const group = this.device_.createBindGroup({
        layout,
        entries: [
          {
            binding: 0,
            resource: texture.createView(),
          },
        ],
      });
      entry = { layout, texture, group };
      this.textureEntries_.push(entry);
    }

    pass.setBindGroup(1, entry.group);
  }

  private createUniformBindGroup(
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
}
