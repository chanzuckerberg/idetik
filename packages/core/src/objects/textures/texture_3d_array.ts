
import { Chunk } from "../../data/chunk";
import { Texture3D } from "./texture_3d";
export class Texture3DArray extends Texture3D {
  public get type() {
    return "Texture3DArray";
  }

  public static createWithChunk(chunk: Chunk) {
    const source = chunk.data;
    if (!source) {
      throw new Error(
        "Unable to create texture, chunk data is not initialized."
      );
    }

    const texture = new Texture3DArray(
      source,
      chunk.shape.x,
      chunk.shape.y,
      chunk.shape.z
    );
    texture.unpackAlignment = chunk.rowAlignmentBytes;
    return texture;
  }
}
