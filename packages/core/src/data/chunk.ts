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
    c: number;
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

export type SlicedChunk2D = {
  data: ChunkData;
  shape: {
    x: number;
    y: number;
    c: number;
  };
  lod: number;
  rowStride: number;
  rowAlignmentBytes: TextureUnpackRowAlignment;
  scale: {
    x: number;
    y: number;
  };
  offset: {
    x: number;
    y: number;
    c: number;
  };
};

export type ChunkSlice2D = {
  z: number;
  c?: number;
};

export function sliceChunk2D(chunk: Chunk, slice: ChunkSlice2D): SlicedChunk2D {
  if (!chunk.data) {
    throw new Error("Cannot slice an unloaded chunk");
  }

  const z = Math.round((slice.z - chunk.offset.z) / chunk.scale.z);
  if (z < 0 || z > chunk.shape.z) {
    throw new Error(
      `z ${z} is out of bounds for chunk with shape.z ${chunk.shape.z}`
    );
  }

  const c = slice.c ? slice.c : 0;
  if (c < 0 || c >= chunk.shape.c) {
    throw new Error(
      `c ${c} is out of bounds for chunk with shape.c ${chunk.shape.c}`
    );
  }

  // TODO: use strides across all dimensions.
  const sliceSize = chunk.rowStride * chunk.shape.y;

  // C is assumed to change more slowly than z.
  const offset = (c * chunk.shape.z + z) * sliceSize;
  const slicedData = chunk.data.subarray(offset, offset + sliceSize);
  return {
    data: slicedData,
    lod: chunk.lod,
    shape: {
      x: chunk.shape.x,
      y: chunk.shape.y,
      c: slice.c ? 1 : chunk.shape.c,
    },
    rowStride: chunk.rowStride,
    rowAlignmentBytes: chunk.rowAlignmentBytes,
    scale: { x: chunk.scale.x, y: chunk.scale.y },
    offset: {
      x: chunk.offset.x,
      y: chunk.offset.y,
      c: slice.c ?? chunk.chunkIndex.c * chunk.shape.c,
    },
  };
}

type VisibleDimension = {
  type: "VisibleDimension";
  name: string;
  sourceIndex: number;
};

export type SliceDimension = {
  type: "SliceDimension";
  name: string;
  sourceIndex: number;
  pointWorld: number;
};

export type DimensionMap = {
  x: VisibleDimension;
  y: VisibleDimension;
  z?: SliceDimension;
  c?: VisibleDimension | SliceDimension;
  t?: SliceDimension;
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

  getDimensionMap(region: Region): DimensionMap;

  loadChunkData(chunk: Chunk, mapping: DimensionMap): Promise<void>;

  getAttributes(): ReadonlyArray<LoaderAttributes>;
};
