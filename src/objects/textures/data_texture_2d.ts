import { Texture } from "objects/textures/texture";

export class DataTexture2D extends Texture {
  private data_: ArrayBufferView;
  private readonly width_: number;
  private readonly height_: number;

  constructor(data: ArrayBufferView, width: number, height: number) {
    super();
    this.data_ = data;
    this.width_ = width;
    this.height_ = height;
  }

  public set data(data: ArrayBufferView) {
    this.data_ = data;
    this.needsUpdate = true;
  }

  public get type() {
    return "DataTexture2D";
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
}
