import { Texture } from "objects/textures/texture";

export class Texture2DArray extends Texture {
  private data_: ArrayBufferView;
  private readonly width_: number;
  private readonly height_: number;
  private readonly depth_: number;
  private readonly sliceByteLength_: number;

  constructor(
    data: ArrayBufferView,
    width: number,
    height: number,
    sliceByteLength: number
  ) {
    super();

    if (data.byteLength < sliceByteLength) {
      throw new Error(
        "The size of a slice must be greater than or equal to the size of the data"
      );
    }

    if (data.byteLength % sliceByteLength !== 0) {
      throw new Error(
        "The size of a slice must be divisible by the size of the data"
      );
    }

    this.data_ = data;
    this.width_ = width;
    this.height_ = height;
    this.sliceByteLength_ = sliceByteLength;
    this.depth_ = data.byteLength / sliceByteLength;
  }

  public get type() {
    return "Texture2DArray";
  }

  public set data(data: ArrayBufferView) {
    this.data_ = data;
    this.needsUpdate = true;
  }

  public get data() {
    return this.data_;
  }

  public get width() {
    return this.width_;
  }

  public get height() {
    return this.height_;
  }

  public get depth() {
    return this.depth_;
  }

  public get layerOffset() {
    return this.sliceByteLength_;
  }
}
