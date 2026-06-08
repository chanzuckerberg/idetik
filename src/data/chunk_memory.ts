import { Chunk, ChunkData } from "./chunk";

// Running totals for CPU-resident chunk voxel data. All mutations of
// `chunk.data` must route through setChunkData/clearChunkData so these stay
// accurate. Module-level (not per-store) because chunk loaders are created
// per-source and have no back-reference to their store; this means the totals
// are summed across all Idetik instances in the page, which is fine for the
// single-instance debug/instrumentation use case.

let cpuChunkBytes = 0;
let cpuChunkCount = 0;

export function setChunkData(chunk: Chunk, data: ChunkData): void {
  if (chunk.data) {
    cpuChunkBytes -= chunk.data.byteLength;
    cpuChunkCount -= 1;
  }
  chunk.data = data;
  cpuChunkBytes += data.byteLength;
  cpuChunkCount += 1;
}

export function clearChunkData(chunk: Chunk): void {
  if (chunk.data) {
    cpuChunkBytes -= chunk.data.byteLength;
    cpuChunkCount -= 1;
  }
  chunk.data = undefined;
}

export function chunkMemoryStats() {
  return { cpuChunkBytes, cpuChunkCount };
}
