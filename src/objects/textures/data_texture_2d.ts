import { Texture } from "objects/textures/texture";

type TextureDataType = Uint8Array | Uint16Array;

export class DataTexture2D extends Texture {
  private readonly data_: TextureDataType;
  private readonly width_: number;
  private readonly height_: number;
  private readonly rowStride_: number;
  private readonly rowAlignmentBytes_: number;

  constructor(
    data: TextureDataType,
    width: number,
    height: number,
    rowStride: number,
    alignmentBytes: number
  ) {
    super();
    this.data_ = data;
    this.width_ = width;
    this.height_ = height;
    this.rowStride_ = rowStride;
    this.rowAlignmentBytes_ = alignmentBytes;
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

  public get rowStride() {
    return this.rowStride_;
  }

  public get rowAlignmentBytes() {
    return this.rowAlignmentBytes_;
  }

  public get type() {
    return "DataTexture2D";
  }
}
