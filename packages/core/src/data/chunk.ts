import { Region } from "./region";
import { TextureUnpackRowAlignment } from "../objects/textures/texture";
import { PromiseScheduler } from "./promise_scheduler";
import { Logger } from "../utilities/logger";

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

export type ChunkViewState = {
  visible: boolean;
  prefetch: boolean;
  priority: number | null;
  orderKey: number | null;
};

export type ChunkDataRange = {
  min: number;
  max: number;
};

export type Chunk = {
  data?: ChunkData;
  dataRange?: ChunkDataRange;
  state: "unloaded" | "queued" | "loading" | "loaded";
  lod: number;
  shape: {
    x: number;
    y: number;
    z: number;
    c: number;
  };
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
} & ChunkViewState;

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
  c?: number[];
  t?: number;
};

export type ChunkSource = {
  open(): Promise<ChunkLoader>;
};

export type ChunkLoader = {
  loadRegion(
    input: Region,
    lod: number,
    scheduler?: PromiseScheduler
  ): Promise<Chunk>;

  getSourceDimensionMap(): SourceDimensionMap;

  loadChunkData(chunk: Chunk, signal: AbortSignal): Promise<void>;
};

export function computeChunkDataRange(data: ChunkData): ChunkDataRange {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

type ChannelDataRange = Record<number, ChunkDataRange>;

export function computeChannelDataRange(
  chunks: Iterable<Chunk>
): ChannelDataRange {
  const result: ChannelDataRange = {};
  for (const chunk of chunks) {
    if (!chunk.dataRange) continue;
    const c = chunk.chunkIndex.c;
    const existing = result[c];
    if (!existing) {
      result[c] = { min: chunk.dataRange.min, max: chunk.dataRange.max };
    } else {
      existing.min = Math.min(existing.min, chunk.dataRange.min);
      existing.max = Math.max(existing.max, chunk.dataRange.max);
    }
  }
  return result;
}

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
