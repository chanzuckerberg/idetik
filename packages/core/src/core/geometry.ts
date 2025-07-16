import { Node } from "./node";

export type Primitive = "triangles" | "points" | "lines";

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
  protected primitive_: Primitive;
  protected attributes_: GeometryAttribute[];
  protected vertexData_: Float32Array;
  protected indexData_: Uint32Array;

  constructor(
    vertexData: number[] = [],
    indexData: number[] = [],
    primitive: Primitive = "triangles"
  ) {
    super();
    this.vertexData_ = new Float32Array(vertexData);
    this.indexData_ = new Uint32Array(indexData);
    this.primitive_ = primitive;
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

  public get primitive() {
    return this.primitive_;
  }

  public get vertexData() {
    return this.vertexData_;
  }

  public get indexData() {
    return this.indexData_;
  }

  public get attributes() {
    return this.attributes_;
  }

  public get type() {
    return "Geometry";
  }
}
