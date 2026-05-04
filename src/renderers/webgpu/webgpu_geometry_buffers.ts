import { Geometry, GeometryAttributeIndex } from "@/core/geometry";

export type WebGPUGeometryBuffer = {
  geometry: Geometry;
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer | null;
  attributes: GPUVertexAttribute[];
  attributesKey: string;
};

export default class WebGPUGeometryBuffers {
  private readonly device_: GPUDevice;
  private readonly buffers_: WebGPUGeometryBuffer[];

  constructor(device: GPUDevice) {
    this.device_ = device;
    this.buffers_ = [];
  }

  public get(geometry: Geometry) {
    const cached = this.buffers_.find((b) => b.geometry === geometry);
    if (cached) return cached;

    const vertexBuffer = this.device_.createBuffer({
      size: geometry.vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });

    new Float32Array(vertexBuffer.getMappedRange()).set(geometry.vertexData);
    vertexBuffer.unmap();

    let indexBuffer: GPUBuffer | null = null;
    if (geometry.indexData.byteLength > 0) {
      indexBuffer = this.device_.createBuffer({
        size: geometry.indexData.byteLength,
        usage: GPUBufferUsage.INDEX,
        mappedAtCreation: true,
      });

      new Uint32Array(indexBuffer.getMappedRange()).set(geometry.indexData);
      indexBuffer.unmap();
    }

    const { attributes, attributesKey } = remapAttributes(geometry);
    const buffers = {
      geometry,
      vertexBuffer,
      indexBuffer,
      attributes,
      attributesKey,
    };

    this.buffers_.push(buffers);

    return buffers;
  }

  public dispose(geometry: Geometry) {
    const index = this.buffers_.findIndex((b) => b.geometry === geometry);
    if (index === -1) return;

    const buffers = this.buffers_[index];
    buffers.vertexBuffer.destroy();
    buffers.indexBuffer?.destroy();
    this.buffers_.splice(index, 1);
  }

  public disposeAll() {
    for (const buffers of this.buffers_) {
      buffers.vertexBuffer.destroy();
      buffers.indexBuffer?.destroy();
    }
    this.buffers_.length = 0;
  }
}

function getVertexFormat(n: number): GPUVertexFormat {
  switch (n) {
    case 2:
      return "float32x2";
    case 3:
      return "float32x3";
    case 4:
      return "float32x4";
    default:
      throw new Error("Unsupported vertex format size");
  }
}

function remapAttributes(geometry: Geometry) {
  const attributes: GPUVertexAttribute[] = [];

  let attributesKey = "";

  for (const attr of geometry.attributes) {
    attributes.push({
      shaderLocation: GeometryAttributeIndex[attr.type],
      offset: attr.offset,
      format: getVertexFormat(attr.itemSize),
    });

    attributesKey += `${attr.type},${attr.offset},${attr.itemSize}|`;
  }

  return { attributes, attributesKey };
}
