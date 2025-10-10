import { Region } from "./region";
import { TextureUnpackRowAlignment } from "../objects/textures/texture";
import { PromiseScheduler } from "./promise_scheduler";
import { Logger } from "../utilities/logger";
import { clamp } from "../utilities/clamp";
import { almostEqual } from "../utilities/almost_equal";

const chunkDataTypes = [
  Int8Array,
  Int16Array,
  Int32Array,
  Uint8Array,
  Uint16Array,
  Uint32Array,
  Float32Array,
] as const;
export type ChunkDataConstructor = (typeof chunkDataTypes)[number];
export type ChunkData = InstanceType<ChunkDataConstructor>;

export function isChunkData(value: unknown): value is ChunkData {
  if (chunkDataTypes.some((ChunkData) => value instanceof ChunkData)) {
    return true;
  }
  const supportedDataTypeNames = chunkDataTypes.map((dtype) => dtype.name);
  Logger.debug(
    "Chunk",
    `Unsupported chunk data type: ${value}. Supported data types: ${supportedDataTypeNames}`
  );
  return false;
}

export type Chunk = {
  data?: ChunkData;
  state: "unloaded" | "queued" | "loading" | "loaded";
  lod: number;
  visible: boolean;
  prefetch: boolean;
  priority: number | null;
  orderKey: number | null;
  shape: {
    x: number;
    y: number;
    z: number;
    c: number;
  };
  rowStride: number;
  rowAlignmentBytes: TextureUnpackRowAlignment;
  chunkIndex: {
    x: number;
    y: number;
    z: number;
    c: number;
    t: number;
  };
  scale: {
    x: number;
    y: number;
    z: number;
  };
  offset: {
    x: number;
    y: number;
    z: number;
  };
};

type SlicedChunkProps = {
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
    this.data = props.data;
    this.shape = props.shape;
    this.scale = props.scale;
    this.offset = props.offset;
    this.rowStride = props.rowStride;
    this.rowAlignmentBytes = props.rowAlignmentBytes;
  }

  public setChannelData(channel: number, data: ChunkData) {
    if (channel < 0 || channel >= this.shape.c) {
      throw new Error("Channel index out of bounds");
    }
    if (data.length !== this.rowStride * this.shape.y) {
      throw new Error("Data length does not match chunk shape");
    }
    const channelOffset = channel * this.rowStride * this.shape.y;
    this.data.set(data, channelOffset);
  }

  static fromChunk(chunk: Chunk, zCoord?: number): SlicedChunk {
    const data = this.slicePlane(chunk, zCoord);
    if (!data) {
      throw new Error("Chunk data is undefined");
    }
    if (chunk.shape.c !== 1) {
      throw new Error("Chunk must be single-channel");
    }
    return new SlicedChunk({
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

  static fromChunks(chunks: Chunk[], zCoord?: number): SlicedChunk {
    if (chunks.length === 0) {
      throw new Error("No chunks provided");
    }
    if (chunks.length === 1) {
      return this.fromChunk(chunks[0], zCoord);
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
    for (let c = 0; c < chunks.length; c++) {
      const chunkData = this.slicePlane(chunk, zCoord);
      if (!chunkData) {
        throw new Error("Chunk data is not loaded");
      }
      data.set(chunkData, c * chunk.shape.x * chunk.shape.y);
    }
    return new SlicedChunk({
      data: data,
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

// Maps Idetik spatial dimensions (x, y, z) and non-spatial dimensions (c, t)
// dimensions to a chunk source's dimensions.
export type SourceDimensionMap = {
  x: SourceDimension;
  y: SourceDimension;
  z?: SourceDimension;
  c?: SourceDimension;
  t?: SourceDimension;
  numLods: number;
};

// A dimension in a chunk source with multiple levels of detail (LODs).
export type SourceDimension = {
  name: string;
  index: number;
  unit?: string;
  lods: SourceDimensionLod[];
};

// Metadata for a source dimension at a specific level of detail (LOD)
// of a multi-resolution image pyramid.
// For example, combines zarr array metadata (size, chunkSize) with
// OME-zarr coordinate transform (scale, translation).
export type SourceDimensionLod = {
  size: number;
  chunkSize: number;
  scale: number;
  translation: number;
};

export type SliceCoordinates = {
  z?: number;
  readonly c?: number;
  t?: number;
};

export type ChunkSource = {
  open(): Promise<ChunkLoader>;
};

export type LoaderAttributes = {
  dimensionNames: string[];
  dimensionUnits: (string | undefined)[];
  chunks: readonly number[];
  shape: readonly number[];
  scale: readonly number[];
  translation: readonly number[];
};

export type ChunkLoader = {
  loadRegion(
    input: Region,
    lod: number,
    scheduler?: PromiseScheduler
  ): Promise<Chunk>;

  getSourceDimensionMap(): SourceDimensionMap;

  loadChunkData(chunk: Chunk, signal: AbortSignal): Promise<void>;

  getAttributes(): ReadonlyArray<LoaderAttributes>;
};

export function coordToIndex(lod: SourceDimensionLod, coord: number): number {
  return Math.round((coord - lod.translation) / lod.scale);
}

export function coordToChunkIndex(
  lod: SourceDimensionLod,
  coord: number
): number {
  const index = coordToIndex(lod, coord);
  return Math.floor(index / lod.chunkSize);
}
