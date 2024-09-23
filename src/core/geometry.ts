import { Node } from "core/node";

type GeometryAttributeType =
  | "position"
  | "normal"
  | "uv"
  | "nextpos"
  | "prevpos"
  | "direction";

type GeometryAttribute = {
  type: GeometryAttributeType;
  itemSize: number;
  offset: number;
};

export class Geometry extends Node {
  protected vertexData_: Float32Array;
  protected indexData_: Uint32Array;
  private attributes_: GeometryAttribute[];
  private stride_: number | null = null;

  constructor(vertexData: number[] = [], indexData: number[] = []) {
    super();
    this.vertexData_ = new Float32Array(vertexData);
    this.indexData_ = new Uint32Array(indexData);
    this.attributes_ = [];
  }

  public addAttribute(attr: GeometryAttribute) {
    this.attributes_.push(attr);
  }

  public get itemSize() {
    return this.vertexData_.length / this.stride;
  }

  public get stride() {
    if (this.stride_ !== null) {
      return this.stride_;
    }
    return (
      this.attributes_.reduce((acc, curr) => {
        return (acc += curr.itemSize);
      }, 0) * Float32Array.BYTES_PER_ELEMENT
    );
  }

  public set stride(value: number) {
    this.stride_ = value;
  }

  public get vertexData() {
    return this.vertexData_;
  }

  public set vertexData(data: Float32Array) {
    this.vertexData_ = data;
  }

  public get indexData() {
    return this.indexData_;
  }

  public set indexData(data: Uint32Array) {
    this.indexData_ = data;
  }

  public get attributes() {
    return this.attributes_;
  }

  public get type() {
    return "Geometry";
  }
}
