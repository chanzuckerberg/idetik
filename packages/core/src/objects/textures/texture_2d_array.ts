import {
  DataTextureTypedArray,
  Texture,
  bufferToDataType,
} from "../../objects/textures/texture";

import { Chunk } from "../../data/chunk";
export class Texture2DArray extends Texture {
  private data_: DataTextureTypedArray;
  private readonly width_: number;
  private readonly height_: number;
  private readonly depth_: number;

  constructor(data: DataTextureTypedArray, width: number, height: number) {
    super();
    this.dataFormat = "scalar";
    this.dataType = bufferToDataType(data);

    this.data_ = data;
    this.width_ = width;
    this.height_ = height;
    // We currently assume that each slice's size is equal to the image's area
    this.depth_ = data.length / (width * height);
  }

  public get type() {
    return "Texture2DArray";
  }

  public set data(data: DataTextureTypedArray) {
    if (this.dataType != bufferToDataType(data)) {
      throw new Error("Unable to set texture data, data type mismatch.");
    }
    if (this.width_ * this.height_ * this.depth_ !== data.length) {
      throw new Error("Unable to set texture data, data length mismatch.");
    }
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

  public updateWithChunk(chunk: Chunk) {
    if (!chunk.data) {
      throw new Error(
        "Unable to update texture, chunk data is not initialized."
      );
    }

    if (this.data === chunk.data) return;

    const width = chunk.shape.x;
    const height = chunk.shape.y;
    const depth = chunk.data.length / (width * height);
    if (
      this.width != width ||
      this.height != height ||
      this.depth_ != depth ||
      this.dataType != bufferToDataType(chunk.data)
    ) {
      throw new Error("Unable to update texture, texture buffer mismatch.");
    }

    this.data = chunk.data;
  }

  public static createWithChunk(chunk: Chunk) {
    if (!chunk.data) {
      throw new Error(
        "Unable to create texture, chunk data is not initialized."
      );
    }
    const texture = new Texture2DArray(
      chunk.data,
      chunk.shape.x,
      chunk.shape.y
    );
    texture.unpackRowLength = chunk.rowStride;
    texture.unpackAlignment = chunk.rowAlignmentBytes;
    return texture;
  }
}
