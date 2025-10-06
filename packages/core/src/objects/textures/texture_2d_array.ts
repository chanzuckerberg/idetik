import {
  DataTextureTypedArray,
  Texture,
  bufferToDataType,
} from "../../objects/textures/texture";

import { Chunk, ChunkData } from "../../data/chunk";
import { Logger } from "@/utilities/logger";
export class Texture2DArray extends Texture {
  private data_: DataTextureTypedArray;
  private readonly width_: number;
  private readonly height_: number;
  private readonly depth_: number;

  constructor(
    data: DataTextureTypedArray,
    width: number,
    height: number,
    depth?: number
  ) {
    super();
    this.dataFormat = "scalar";
    this.dataType = bufferToDataType(data);

    this.data_ = data;
    this.width_ = width;
    this.height_ = height;
    // We currently assume that each slice's size is equal to the image's area
    if (depth === undefined) {
      depth = data.length / (width * height);
    }
    this.depth_ = depth;
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
      throw new Error("Unable to update texture, texture buffer mismatch.");
    }

    const offset = chunk.chunkIndex.c * width * height;
    Logger.debug("Texture2DArray", "updateWithChunk", chunk, offset);
    this.data.set(source, offset);
    this.needsUpdate = true;
    return;
  }

  public static createWithChunk(
    chunk: Chunk,
    numChannels?: number,
    data?: ChunkData
  ) {
    let source = data ?? chunk.data;
    if (!source) {
      throw new Error(
        "Unable to create texture, chunk data is not initialized."
      );
    }
    if (numChannels !== undefined) {
      const bufferSize = numChannels * chunk.shape.y * chunk.shape.x;
      const TypedArray = source.constructor as new (size: number) => ChunkData;
      source = new TypedArray(bufferSize);
    }
    const texture = new Texture2DArray(
      source,
      chunk.shape.x,
      chunk.shape.y,
      numChannels
    );
    texture.unpackRowLength = chunk.rowStride;
    texture.unpackAlignment = chunk.rowAlignmentBytes;
    return texture;
  }
}
