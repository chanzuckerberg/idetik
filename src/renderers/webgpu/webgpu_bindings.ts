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
  textures: GPUTexture[];
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

  // Drop cached bind groups that reference a texture whose GPU resource is
  // about to be destroyed. Without this, entries pile up referencing dead
  // GPUTextures -- they never match again (new textures have new identities)
  // but the find() walk in setTextures still has to iterate them every draw.
  public removeTexture(texture: GPUTexture) {
    for (let i = this.textureEntries_.length - 1; i >= 0; i--) {
      if (this.textureEntries_[i].textures.includes(texture)) {
        this.textureEntries_.splice(i, 1);
      }
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

  public setTextures(
    pass: GPURenderPassEncoder,
    pipeline: WebGPUPipeline,
    textures: GPUTexture[]
  ) {
    const layout = pipeline.layouts.texture;
    if (!layout) {
      throw new Error("setTextures called on pipeline without a texture layout");
    }

    let entry = this.textureEntries_.find(
      (e) =>
        e.layout === layout &&
        e.textures.length === textures.length &&
        e.textures.every((t, i) => t === textures[i])
    );

    if (!entry) {
      const group = this.device_.createBindGroup({
        layout,
        entries: textures.map((texture, i) => ({
          binding: i,
          resource: texture.createView(),
        })),
      });
      entry = { layout, textures: [...textures], group };
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
