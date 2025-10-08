import {
  DataTextureTypedArray,
  Texture,
  bufferToDataType,
} from "../../objects/textures/texture";

import { Chunk, ChunkData } from "../../data/chunk";
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

  public updateWithChunk(chunk: Chunk, data?: ChunkData) {
    const source = data ?? chunk.data;
    if (!source) {
      throw new Error(
        "Unable to update texture, chunk data is not initialized."
      );
    }

    if (this.data === source) return;

    const width = chunk.shape.x;
    const height = chunk.shape.y;
    if (
      this.width != width ||
      this.height != height ||
      this.dataType != bufferToDataType(source)
    ) {
      throw new Error(
        `Unable to update texture, shape mismatch. Current: ${this.width}x${this.height} vs. new: ${width}x${height}`
      );
    }

    // Allow source data with a depth of 1 to be updated into a texture with greater depth
    // to allow for single-channel updates.
    const depth = source.length / (width * height);
    if (depth > 1 && this.depth != depth) {
      throw new Error(
        `Unable to update texture, depth mismatch. Current: ${this.depth} vs. new: ${depth}`
      );
    }

    if (this.dataType != bufferToDataType(source)) {
      throw new Error(
        "Unable to update texture, data type mismatch. Current: ${this.dataType} vs. new: ${bufferToDataType(source)}"
      );
    }

    const offset = chunk.chunkIndex.c * width * height * depth;
    this.data.set(source, offset);
    this.needsUpdate = true;
    return;
  }

  public static createWithChunk(chunk: Chunk, data?: ChunkData) {
    const source = data ?? chunk.data;
    if (!source) {
      throw new Error(
        "Unable to create texture, chunk data is not initialized."
      );
    }
    const texture = new Texture2DArray(source, chunk.shape.x, chunk.shape.y);
    texture.unpackRowLength = chunk.rowStride;
    texture.unpackAlignment = chunk.rowAlignmentBytes;
    return texture;
  }
}
