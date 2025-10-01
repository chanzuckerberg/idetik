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
  c?: number;
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

  loadChunkData(
    chunk: Chunk,
    sliceCoords: SliceCoordinates,
    signal: AbortSignal
  ): Promise<void>;

  getAttributes(): ReadonlyArray<LoaderAttributes>;
};

const CONVERSION_TOLERANCE: Readonly<number> = 10 * Number.EPSILON;

export function coordToIndex(lod: SourceDimensionLod, coord: number): number {
  // We draw a 2D chunk with no translation from (0, 0), so the extent of that
  // chunk is [0, scale), therefore we floor the conversion. We add a small
  // multiple of floating point precision before flooring to account for loss
  // of precision from the conversion.
  const index = (coord - lod.translation) / lod.scale;
  return Math.floor(index + CONVERSION_TOLERANCE);
}

export function coordToChunkIndex(lod: SourceDimensionLod, coord: number): number {
  const index = (coord - lod.translation) / (lod.scale * lod.chunkSize);
  return Math.floor(index + CONVERSION_TOLERANCE);
}