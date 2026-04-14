import { Geometry, GeometryAttributeIndex } from "@/core/geometry";

export type WebGPUGeometryBuffer = {
  geometry: Geometry;
  vertex: GPUBuffer;
  index: GPUBuffer;
  attributes: GPUVertexAttribute[];
  attributesKey: string;
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

    const { attributes, attributesKey } = remapAttributes(geometry);
    const buffers = { geometry, vertex, index, attributes, attributesKey };

    this.buffers_.push(buffers);

    return buffers;
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
