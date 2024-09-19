import { Texture } from "../../objects/textures/texture";

export class Uint16Texture2D extends Texture {
  private readonly data_: Uint16Array;
  private readonly width_: number;
  private readonly height_: number;
  private readonly rowLength_: number;

  constructor(
    data: Uint16Array,
    width: number,
    height: number,
    rowLength: number
  ) {
    super();
    this.data_ = data;
    this.width_ = width;
    this.height_ = height;
    this.rowLength_ = rowLength;
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

  public get rowLength() {
    return this.rowLength_;
  }

  public get type() {
    return "Uint16Texture2D";
  }
}
