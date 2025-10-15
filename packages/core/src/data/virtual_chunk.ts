import { Chunk, ChunkData } from "./chunk";
import { TextureUnpackRowAlignment } from "../objects/textures/texture";
import { clamp } from "../utilities/clamp";
import { almostEqual } from "../utilities/almost_equal";
import { Logger } from "../utilities/logger";

type VirtualChunkProps = {
  chunks: ReadonlyArray<Chunk>;
  lod: number;
  shape: {
    x: number;
    y: number;
    c: number;
  };
  scale: {
    x: number;
    y: number;
  };
  offset: {
    x: number;
    y: number;
  };
  rowStride: number;
  rowAlignmentBytes: TextureUnpackRowAlignment;
};

export class VirtualChunk {
  readonly chunks: ReadonlyArray<Chunk>;
  readonly lod: number;
  readonly shape: {
    x: number;
    y: number;
    c: number;
  };
  readonly scale: {
    x: number;
    y: number;
  };
  readonly offset: {
    x: number;
    y: number;
  };
  readonly rowStride: number;
  readonly rowAlignmentBytes: TextureUnpackRowAlignment;

  private constructor(props: VirtualChunkProps) {
    this.chunks = props.chunks;
    this.lod = props.lod;
    this.shape = props.shape;
    this.scale = props.scale;
    this.offset = props.offset;
    this.rowStride = props.rowStride;
    this.rowAlignmentBytes = props.rowAlignmentBytes;
  }

  public slicePlane(zCoord?: number): ChunkData {
    const chunk = this.chunks[0];
    const TypedArray = chunk.data!.constructor as new (
      size: number
    ) => ChunkData;
    const data = new TypedArray(
      this.chunks.length * this.rowStride * this.shape.y
    );
    for (let c = 0; c < this.chunks.length; c++) {
      const chunk = this.chunks[c];
      const chunkData = VirtualChunk.slicePlane(chunk, zCoord);
      data.set(chunkData, c * this.rowStride * this.shape.y);
    }
    return data;
  }

  private static slicePlane(chunk: Chunk, zCoord?: number): ChunkData {
    if (!chunk.data) {
      throw new Error("Chunk data is not loaded");
    }
    if (zCoord === undefined) return chunk.data;
    const zLocal = (zCoord - chunk.offset.z) / chunk.scale.z;
    const zIdx = Math.round(zLocal);
    const zClamped = clamp(zIdx, 0, chunk.shape.z - 1);

    // Treat values within ~1 voxel (plus tiny floating-point error) as OK.
    // Anything further away means the requested zValue is outside.
    if (!almostEqual(zLocal, zClamped, 1 + 1e-6)) {
      Logger.error("Chunk", "slicePlane zValue outside extent");
    }

    const sliceSize = chunk.rowStride * chunk.shape.y;
    const offset = zClamped * sliceSize;
    return chunk.data.subarray(offset, offset + sliceSize);
  }

  static fromChunks(chunks: ReadonlyArray<Chunk>): VirtualChunk {
    if (chunks.length === 0) {
      throw new Error("No chunks provided");
    }
    const refChunk = chunks[0];
    for (const chunk of chunks) {
      if (!chunk.data) {
        throw new Error("Chunk data is not loaded");
      }
      if (chunk.shape.c !== 1) {
        throw new Error("All chunks must be single-channel");
      }
      if (
        chunk.shape.x !== refChunk.shape.x ||
        chunk.shape.y !== refChunk.shape.y
      ) {
        throw new Error("All chunks must have the same x and y shape");
      }
      if (
        chunk.scale.x !== refChunk.scale.x ||
        chunk.scale.y !== refChunk.scale.y
      ) {
        throw new Error("All chunks must have the same x and y scale");
      }
      if (
        chunk.offset.x !== refChunk.offset.x ||
        chunk.offset.y !== refChunk.offset.y
      ) {
        throw new Error("All chunks must have the same x and y offset");
      }
      if (chunk.lod !== refChunk.lod) {
        throw new Error("All chunks must have the same LOD");
      }
      if (chunk.rowStride !== refChunk.rowStride) {
        throw new Error("All chunks must have the same row stride");
      }
      if (chunk.rowAlignmentBytes !== refChunk.rowAlignmentBytes) {
        throw new Error("All chunks must have the same row alignment");
      }
    }
    return new VirtualChunk({
      chunks: chunks.slice().sort((a, b) => a.chunkIndex.c - b.chunkIndex.c),
      lod: refChunk.lod,
      shape: {
        x: refChunk.shape.x,
        y: refChunk.shape.y,
        c: chunks.length,
      },
      scale: {
        x: refChunk.scale.x,
        y: refChunk.scale.y,
      },
      offset: {
        x: refChunk.offset.x,
        y: refChunk.offset.y,
      },
      rowStride: refChunk.rowStride,
      rowAlignmentBytes: refChunk.rowAlignmentBytes,
    });
  }
}
