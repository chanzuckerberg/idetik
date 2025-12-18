import {
  DataTextureTypedArray,
  Texture,
  bufferToDataType,
} from "../../objects/textures/texture";

import { Chunk, ChunkData } from "../../data/chunk";
import { Logger } from "@/utilities/logger";
export class Texture3DArray extends Texture {
  private data_: DataTextureTypedArray;
  private readonly width_: number;
  private readonly height_: number;
  private readonly depth_: number;

  constructor(
    data: DataTextureTypedArray,
    width: number,
    height: number,
    depth: number
  ) {
    super();
    this.dataFormat = "scalar";
    this.dataType = bufferToDataType(data);

    this.data_ = data;
    this.width_ = width;
    this.height_ = height;
    // We currently assume that each slice's size is equal to the image's area
    this.depth_ = depth;
  }

  public get type() {
    return "Texture3DArray";
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
    const depth =
      chunk.shape.c > 0 ? chunk.shape.z * chunk.shape.c : chunk.shape.z;
    if (
      this.width != width ||
      this.height != height ||
      this.depth_ != depth ||
      this.dataType != bufferToDataType(source)
    ) {
      throw new Error("Unable to update texture, texture buffer mismatch.");
    }

    this.data = source;
  }

  public static createWithChunk(chunk: Chunk, data?: ChunkData) {
    const source = data ?? chunk.data;
    if (!source) {
      throw new Error(
        "Unable to create texture, chunk data is not initialized."
      );
    }
    Logger.debug(
      "Texture3DArray",
      "shape",
      chunk.shape,
      "chunk index",
      chunk.chunkIndex
    );

    // depth = z * c (?)
    const depth =
      chunk.shape.c > 0 ? chunk.shape.z * chunk.shape.c : chunk.shape.z;
    const texture = new Texture3DArray(
      source,
      chunk.shape.x,
      chunk.shape.y,
      depth
    );
    texture.unpackAlignment = chunk.rowAlignmentBytes;
    return texture;
  }
}
