import type { Chunk } from "@/data/chunk";

type ChunkOverrides = Partial<
  Omit<Chunk, "shape" | "chunkIndex" | "scale" | "offset">
> & {
  shape?: Partial<Chunk["shape"]>;
  chunkIndex?: Partial<Chunk["chunkIndex"]>;
  scale?: Partial<Chunk["scale"]>;
  offset?: Partial<Chunk["offset"]>;
};

export function makeChunk(overrides: ChunkOverrides = {}): Chunk {
  const { shape, chunkIndex, scale, offset, ...rest } = overrides;

  const defaultChunk: Chunk = {
    state: "unloaded",
    lod: 0,
    visible: false,
    prefetch: false,
    priority: null,
    shape: { x: 256, y: 256, z: 256, c: 1 },
    rowStride: 256,
    rowAlignmentBytes: 1,
    chunkIndex: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    offset: { x: 0, y: 0, z: 0 },
  };

  return {
    ...defaultChunk,
    ...rest,
    shape: { ...defaultChunk.shape, ...(shape ?? {}) },
    chunkIndex: { ...defaultChunk.chunkIndex, ...(chunkIndex ?? {}) },
    scale: { ...defaultChunk.scale, ...(scale ?? {}) },
    offset: { ...defaultChunk.offset, ...(offset ?? {}) },
  };
}
