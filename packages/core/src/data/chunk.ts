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

export type ChunkSlice2D = {
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

export function sliceChunk2D(
  chunk: Chunk,
  sliceCoords: SliceCoordinates
): ChunkSlice2D {
  if (!chunk.data) {
    throw new Error("Cannot slice an unloaded chunk");
  }

  if (sliceCoords.c !== undefined && sliceCoords.c !== 0) {
    throw new Error("Slicing with c is not yet supported");
  }

  if (chunk.shape.c !== 1) {
    throw new Error("Slicing chunky channels is not yet supported");
  }

  // TODO: fix the rounding behavior later.
  const z =
    sliceCoords.z !== undefined
      ? Math.floor((sliceCoords.z - chunk.offset.z) / chunk.scale.z)
      : 0;
  if (z < 0 || z > chunk.shape.z) {
    throw new Error(
      `z ${z} is out of bounds for chunk with shape.z ${chunk.shape.z}`
    );
  }

  const t =
    sliceCoords.t !== undefined
      ? Math.floor((sliceCoords.t - chunk.offset.t) / chunk.scale.t)
      : 0;
  if (t < 0 || t > chunk.shape.t) {
    throw new Error(
      `t ${t} is out of bounds for chunk with shape.t ${chunk.shape.t}`
    );
  }

  // TODO: use strides across all dimensions.
  const planeSize = chunk.rowStride * chunk.shape.y;

  // TCZYX order assumed.
  const offset = (t * chunk.shape.z + z) * planeSize;
  const slicedData = chunk.data.slice(offset, offset + planeSize);
  return {
    data: slicedData,
    lod: chunk.lod,
    shape: {
      x: chunk.shape.x,
      y: chunk.shape.y,
      c: 1,
    },
    rowStride: chunk.rowStride,
    rowAlignmentBytes: chunk.rowAlignmentBytes,
    scale: { x: chunk.scale.x, y: chunk.scale.y },
    offset: {
      x: chunk.offset.x,
      y: chunk.offset.y,
      c: 0,
    },
  };
}

export type Chunk = {
  data?: ChunkData;
  state: "unloaded" | "queued" | "loading" | "loaded";
  lod: number;
  visible: boolean;
  prefetch: boolean;
  priority: number | null;
  shape: {
    x: number;
    y: number;
    z: number;
    c: number;
    t: number;
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
    t: number;
  };
  offset: {
    x: number;
    y: number;
    z: number;
    t: number;
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

  loadChunkData(chunk: Chunk, sliceCoords: SliceCoordinates): Promise<void>;

  getAttributes(): ReadonlyArray<LoaderAttributes>;
};
