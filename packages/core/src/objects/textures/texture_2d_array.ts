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

  public updateWithChunk(
    chunk: Chunk,
    data?: ChunkData,
    orientation: "xy" | "xz" | "yz" = "xy"
  ) {
    const source = data ?? chunk.data;
    if (!source) {
      throw new Error(
        "Unable to update texture, chunk data is not initialized."
      );
    }

    if (this.data === source) return;

    const { width, height } = Texture2DArray.getTextureDimensions(
      chunk,
      orientation
    );
    const depth = source.length / (width * height);
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

  public static createWithChunk(
    chunk: Chunk,
    data?: ChunkData,
    orientation: "xy" | "xz" | "yz" = "xy"
  ) {
    const source = data ?? chunk.data;
    if (!source) {
      throw new Error(
        "Unable to create texture, chunk data is not initialized."
      );
    }

    const { width, height } = Texture2DArray.getTextureDimensions(
      chunk,
      orientation
    );
    const texture = new Texture2DArray(source, width, height);
    texture.unpackAlignment = chunk.rowAlignmentBytes;
    return texture;
  }

  /**
   * Get texture dimensions for a chunk based on orientation.
   * Returns the width and height for creating a 2D texture from the chunk data.
   */
  private static getTextureDimensions(
    chunk: Chunk,
    orientation: "xy" | "xz" | "yz"
  ): { width: number; height: number } {
    switch (orientation) {
      case "xy":
        return { width: chunk.shape.x, height: chunk.shape.y };
      case "xz":
        return { width: chunk.shape.x, height: chunk.shape.z };
      case "yz":
        return { width: chunk.shape.z, height: chunk.shape.y };
    }
  }
}
