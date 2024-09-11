import { Texture } from "./texture";

export class DataTexture2D extends Texture { 
  private readonly data_: Uint16Array;
  private readonly width_: number;
  private readonly height_: number;

  constructor(data: Uint16Array, width: number, height: number) {
    super();
    this.data_ = data;
    this.width_ = width;
    this.height_ = height;
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

  public get type() {
    return "DataTexture2D";
  }
}