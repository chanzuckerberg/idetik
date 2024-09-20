import { Texture } from "objects/textures/texture";

type TextureDataType = Uint8Array | Uint16Array;

export class DataTexture2D extends Texture {
  private readonly data_: TextureDataType;
  private readonly width_: number;
  private readonly height_: number;
  private readonly rowLength_: number;
  private readonly unpackAlignment_: number;

  constructor(
    data: TextureDataType,
    width: number,
    height: number,
    rowLength: number,
    unpackAlignment: number,
  ) {
    super();
    this.data_ = data;
    this.width_ = width;
    this.height_ = height;
    this.rowLength_ = rowLength;
    this.unpackAlignment_ = unpackAlignment;
  }

  public get data() {
    return this.data_;
  }

  public get dataType(): string {
    return this.data.constructor.name;
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

  public get unpackAlignment() {
    return this.unpackAlignment_;
  }

  public get type() {
    return "DataTexture2D";
  }
}
