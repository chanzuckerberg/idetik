import { Region } from "./region";
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
export type ChunkData = InstanceType<(typeof chunkDataTypes)[number]>;

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

export type ChunkDimensionMap = {
  x: ChunkDimension;
  y: ChunkDimension;
  z?: ChunkDimension;
  c?: ChunkDimension;
  t?: ChunkDimension;
};

export type ChunkDimension = {
  name: string;
  index: number;
  unit?: string;
  lods: ChunkDimensionLod[];
};

export type ChunkDimensionLod = {
  size: number;
  chunkSize: number;
  scale: number;
  translation: number;
};

export type Region2D = {
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

  getDimensionMap(): ChunkDimensionMap;

  loadChunkData(chunk: Chunk, region: Region2D): Promise<void>;

  getAttributes(): ReadonlyArray<LoaderAttributes>;
};
