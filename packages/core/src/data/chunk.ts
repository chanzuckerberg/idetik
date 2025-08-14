import { Region, Region2D } from "./region";
import { TextureUnpackRowAlignment } from "../objects/textures/texture";
import { PromiseScheduler } from "./promise_scheduler";

const chunkDataTypes = [
  Int8Array,
  Int16Array,
  Int32Array,
  Uint8Array,
  Uint16Array,
  Uint32Array,
  Float32Array,
] as const;
type ChunkData = InstanceType<(typeof chunkDataTypes)[number]>;

export function isChunkData(value: unknown): value is ChunkData {
  if (chunkDataTypes.some((ChunkData) => value instanceof ChunkData)) {
    return true;
  }
  const supportedDataTypeNames = chunkDataTypes.map((dtype) => dtype.name);
  console.debug(
    `Unsupported chunk data type: ${value}. Supported data types: ${supportedDataTypeNames}`
  );
  return false;
}

export type Chunk = {
  data?: ChunkData;
  state: "unloaded" | "loading" | "loaded";
  lod: number;
  visible: boolean;
  prefetch: boolean;
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

export type ChunkSource = {
  open(): Promise<ChunkLoader>;
};

// Describes a single dimension of a chunked array (e.g. from an OME-Zarr).
export type ChunkedArrayDimension = {
  name: string;
  index: number;
  size: number;
  chunkSize: number;
  scale: number;
  translation: number;
  unit?: string;
};

// Maps from Idetik dimension names to chunked array dimensions.
export type ChunkedArrayDimensions = {
  x: ChunkedArrayDimension;
  y: ChunkedArrayDimension;
  z?: ChunkedArrayDimension;
  c?: ChunkedArrayDimension;
  t?: ChunkedArrayDimension;
};

// Maps from Idetik dimension names to source dimension names.
export type DimensionMapping = {
  x: string;
  y: string;
  z?: string;
  c?: string;
  t?: string;
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

  loadChunkDataFromRegion(chunk: Chunk, region: Region2D): Promise<void>;

  getDimensions(): ReadonlyArray<ChunkedArrayDimensions>;

  getAttributes(): ReadonlyArray<LoaderAttributes>;
};
