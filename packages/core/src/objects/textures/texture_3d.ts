import { DataTextureTypedArray, Texture, bufferToDataType } from "./texture";
import { Chunk, ChunkData } from "../../data/chunk";

export class Texture3D extends Texture {
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
    this.depth_ = depth;
  }

  public set data(data: DataTextureTypedArray) {
    this.data_ = data;
    this.needsUpdate = true;
  }

  public get type() {
    return "Texture3D";
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

    if (
      this.width != chunk.shape.x ||
      this.height != chunk.shape.y ||
      this.depth != chunk.shape.z ||
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

    const texture = new Texture3D(
      source,
      chunk.shape.x,
      chunk.shape.y,
      chunk.shape.z
    );
    texture.unpackAlignment = chunk.rowAlignmentBytes;
    return texture;
  }
}
