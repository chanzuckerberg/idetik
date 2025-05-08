import {
  DataTextureTypedArray,
  Texture,
  bufferToDataType,
} from "../../objects/textures/texture";
import { ImageChunk } from "../../data/image_chunk";

export class Texture2D extends Texture {
  private data_: DataTextureTypedArray;
  private readonly width_: number;
  private readonly height_: number;

  constructor(data: DataTextureTypedArray, width: number, height: number) {
    super();
    this.dataFormat = "scalar";
    this.dataType = bufferToDataType(data);

    this.data_ = data;
    this.width_ = width;
    this.height_ = height;
  }

  public set data(data: DataTextureTypedArray) {
    this.data_ = data;
    this.needsUpdate = true;
  }

  public get type() {
    return "Texture2D";
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

  public static createWithImageChunk(chunk: ImageChunk) {
    const texture = new Texture2D(chunk.data, chunk.shape.x, chunk.shape.y);
    texture.unpackRowLength = chunk.rowStride;
    texture.unpackAlignment = chunk.rowAlignmentBytes;
    return texture;
  }
}
