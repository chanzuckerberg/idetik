import { Texture } from "objects/textures/texture";

export class Texture2DArray extends Texture {
  private data_: ArrayBufferView;
  private readonly width_: number;
  private readonly height_: number;
  private readonly depth_: number;

  constructor(data: ArrayBufferView, width: number, height: number) {
    super();

    this.data_ = data;
    this.width_ = width;
    this.height_ = height;
    // We currently assume that each slice's size is equal to the image's area
    this.depth_ = data.byteLength / (width * height) / this.bytesPerElement;
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

  private get bytesPerElement(): number {
    switch (this.data_.constructor.name) {
      case "Uint8Array":
      case "Int8Array":
        return 1;
      case "Uint16Array":
      case "Int16Array":
        return 2;
      case "Uint32Array":
      case "Int32Array":
      case "Float32Array":
        return 4;
      default:
        return 1;
    }
  }
}
