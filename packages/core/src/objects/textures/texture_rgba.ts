import { TextureData, Texture } from "../../objects/textures/texture";

export class TextureRgba extends Texture {
  private data_: TextureData;
  private readonly width_: number;
  private readonly height_: number;

  constructor(data: TextureData, width: number, height: number) {
    super();
    this.data_ = data;
    this.width_ = width;
    this.height_ = height;
    this.dataFormat = "rgba";
    this.dataType = "unsigned_byte";
  }

  public set data(data: TextureData) {
    this.data_ = data;
    this.needsUpdate = true;
  }

  public get type() {
    return "TextureRgba";
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
