import { Node } from "./node";
import { Logger } from "../utilities/logger";

type GeometryAttributeType =
  | "position"
  | "normal"
  | "uv"
  | "next_position"
  | "previous_position"
  | "direction"
  | "path_proportion"
  | "color"
  | "size"
  | "marker";

export const GeometryAttributeIndex: Record<GeometryAttributeType, number> = {
  position: 0,
  normal: 1,
  uv: 2,
  next_position: 3,
  previous_position: 4,
  direction: 5,
  path_proportion: 6,
  color: 7,
  size: 8,
  marker: 9,
};

type GeometryAttribute = {
  type: GeometryAttributeType;
  itemSize: number;
  offset: number;
};

export class Geometry extends Node {
  private readonly attributes_: GeometryAttribute[];
  protected vertexData_: Float32Array;
  protected indexData_: Uint32Array;
  private wireframeIndexData_: Uint32Array;

  constructor(vertexData: number[] = [], indexData: number[] = []) {
    super();
    this.vertexData_ = new Float32Array(vertexData);
    this.indexData_ = new Uint32Array(indexData);
    this.wireframeIndexData_ = new Uint32Array();
    this.attributes_ = [];
  }

  public addAttribute(attr: GeometryAttribute) {
    this.attributes_.push(attr);
  }

  public get vertexCount() {
    return this.vertexData_.byteLength / this.stride;
  }

  public get stride() {
    return (
      this.attributes_.reduce((acc, curr) => {
        return acc + curr.itemSize;
      }, 0) * Float32Array.BYTES_PER_ELEMENT
    );
  }

  public get vertexData() {
    return this.vertexData_;
  }

  public get indexData() {
    return this.indexData_;
  }

  public get wireframeIndexData() {
    return this.wireframeIndexData_;
  }

  public get attributes() {
    return this.attributes_;
  }

  public get type() {
    return "Geometry";
  }

  public generateWireframeIndexData() {
    const indexData = this.indexData_;

    if (indexData.length === 0) {
      Logger.warn(
        "Geometry",
        "Wireframe generation error: only indexed geometries are supported"
      );
      return;
    }

    if (indexData.length % 3 !== 0) {
      Logger.warn("Geometry", "Wireframe generation error: non-triangle data");
      return;
    }

    const edgeSet = new Set<{ i0: number; i1: number }>();
    const wireframeIndices: number[] = [];
    const addEdge = (a: number, b: number) => {
      // Normalize edge order and use a set to deduplicate,
      // since shared edges between triangles would otherwise
      // be added multiple times.
      const i0 = Math.min(a, b);
      const i1 = Math.max(a, b);
      if (!edgeSet.has({ i0, i1 })) {
        edgeSet.add({ i0, i1 });
        wireframeIndices.push(i0, i1);
      }
    };

    for (let i = 0; i < indexData.length; i += 3) {
      const i0 = indexData[i];
      const i1 = indexData[i + 1];
      const i2 = indexData[i + 2];

      addEdge(i0, i1);
      addEdge(i1, i2);
      addEdge(i2, i0);
    }

    this.wireframeIndexData_ = new Uint32Array(wireframeIndices);
  }
}
