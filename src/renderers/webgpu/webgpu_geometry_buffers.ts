import { Geometry } from "@/core/geometry";

type WebGPUGeometryBuffer = {
  geometry: Geometry;
  vertex: GPUBuffer;
  index: GPUBuffer;
};

export default class WebGPUGeometryBuffers {
  private readonly device_: GPUDevice;
  private readonly buffers_: WebGPUGeometryBuffer[];

  constructor(device: GPUDevice) {
    this.buffers_ = [];
    this.device_ = device;
  }

  public get(geometry: Geometry) {
    const cached = this.buffers_.find((b) => b.geometry === geometry);
    if (cached) return cached;

    const vertex = this.device_.createBuffer({
      size: geometry.vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(vertex.getMappedRange()).set(geometry.vertexData);
    vertex.unmap();

    const index = this.device_.createBuffer({
      size: geometry.indexData.byteLength,
      usage: GPUBufferUsage.INDEX,
      mappedAtCreation: true,
    });
    new Uint32Array(index.getMappedRange()).set(geometry.indexData);
    index.unmap();

    const buffers = { geometry, vertex, index };
    this.buffers_.push(buffers);

    return buffers;
  }
}
