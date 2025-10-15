import { Chunk, ChunkData } from "./chunk";
import { TextureUnpackRowAlignment } from "../objects/textures/texture";
import { clamp } from "../utilities/clamp";
import { almostEqual } from "../utilities/almost_equal";
import { Logger } from "../utilities/logger";

type SlicedChunkProps = {
  chunks: ReadonlyArray<Chunk>;
  data: ChunkData;
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

export class SlicedChunk {
  readonly chunks: ReadonlyArray<Chunk>;
  readonly data: ChunkData;
  readonly lod: number = 0;
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

  private constructor(props: SlicedChunkProps) {
    this.chunks = props.chunks;
    this.data = props.data;
    this.shape = props.shape;
    this.scale = props.scale;
    this.offset = props.offset;
    this.rowStride = props.rowStride;
    this.rowAlignmentBytes = props.rowAlignmentBytes;
  }

  public sliceChunks(zCoord?: number) {
    for (let c = 0; c < this.chunks.length; c++) {
      const chunk = this.chunks[c];
      const chunkData = SlicedChunk.slicePlane(chunk, zCoord);
      if (!chunkData) {
        throw new Error("Chunk data is not loaded");
      }
      this.data.set(chunkData, c * chunk.shape.x * chunk.shape.y);
    }
  }

  static fromChunk(chunk: Chunk, zCoord?: number): SlicedChunk {
    const data = SlicedChunk.slicePlane(chunk, zCoord);
    if (!data) {
      throw new Error("Chunk data is undefined");
    }
    if (chunk.shape.c !== 1) {
      throw new Error("Chunk must be single-channel");
    }
    return new SlicedChunk({
      chunks: [chunk],
      data: data,
      lod: chunk.lod,
      shape: {
        x: chunk.shape.x,
        y: chunk.shape.y,
        c: 1,
      },
      scale: {
        x: chunk.scale.x,
        y: chunk.scale.y,
      },
      offset: {
        x: chunk.offset.x,
        y: chunk.offset.y,
      },
      rowStride: chunk.rowStride,
      rowAlignmentBytes: chunk.rowAlignmentBytes,
    });
  }

  static fromChunks(
    chunks: ReadonlyArray<Chunk>,
    zCoord?: number
  ): SlicedChunk {
    if (chunks.length === 0) {
      throw new Error("No chunks provided");
    }
    if (chunks.length === 1) {
      return SlicedChunk.fromChunk(chunks[0], zCoord);
    }
    for (const chunk of chunks) {
      if (!chunk.data) {
        throw new Error("Chunk data is not loaded");
      }
      if (chunk.shape.c !== 1) {
        throw new Error("All chunks must be single-channel");
      }
      if (
        chunk.shape.x !== chunks[0].shape.x ||
        chunk.shape.y !== chunks[0].shape.y
      ) {
        throw new Error("All chunks must have the same x and y shape");
      }
      if (
        chunk.scale.x !== chunks[0].scale.x ||
        chunk.scale.y !== chunks[0].scale.y
      ) {
        throw new Error("All chunks must have the same x and y scale");
      }
      if (
        chunk.offset.x !== chunks[0].offset.x ||
        chunk.offset.y !== chunks[0].offset.y
      ) {
        throw new Error("All chunks must have the same x and y offset");
      }
      if (chunk.lod !== chunks[0].lod) {
        throw new Error("All chunks must have the same LOD");
      }
      if (chunk.rowStride !== chunks[0].rowStride) {
        throw new Error("All chunks must have the same row stride");
      }
      if (chunk.rowAlignmentBytes !== chunks[0].rowAlignmentBytes) {
        throw new Error("All chunks must have the same row alignment");
      }
    }
    const chunk = chunks[0];
    const TypedArray = chunk.data!.constructor as new (
      size: number
    ) => ChunkData;
    const data = new TypedArray(
      chunks.length * chunk.rowStride * chunk.shape.y
    );
    const sliced = new SlicedChunk({
      chunks: chunks.slice().sort((a, b) => a.chunkIndex.c - b.chunkIndex.c),
      data,
      lod: chunk.lod,
      shape: {
        x: chunk.shape.x,
        y: chunk.shape.y,
        c: chunks.length,
      },
      scale: {
        x: chunk.scale.x,
        y: chunk.scale.y,
      },
      offset: {
        x: chunk.offset.x,
        y: chunk.offset.y,
      },
      rowStride: chunk.rowStride,
      rowAlignmentBytes: chunk.rowAlignmentBytes,
    });
    sliced.sliceChunks(zCoord);
    return sliced;
  }

  private static slicePlane(chunk: Chunk, z?: number): ChunkData | undefined {
    if (!chunk.data) return;
    if (z === undefined) return chunk.data;
    const zLocal = (z - chunk.offset.z) / chunk.scale.z;
    const zIdx = Math.round(zLocal);
    const zClamped = clamp(zIdx, 0, chunk.shape.z - 1);

    // Treat values within ~1 voxel (plus tiny floating-point error) as OK.
    // Anything further away means the requested zValue is outside.
    if (!almostEqual(zLocal, zClamped, 1 + 1e-6)) {
      Logger.error("Chunk", "slicePlane zValue outside extent");
    }

    const sliceSize = chunk.rowStride * chunk.shape.y;
    const offset = zClamped * sliceSize;
    return chunk.data.slice(offset, offset + sliceSize);
  }
}
