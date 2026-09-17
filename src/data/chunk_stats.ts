import { Chunk, ChunkSource } from "./chunk";
import type { ChunkStore } from "./chunk_store";

/** Chunk counts for one timepoint, at the level of detail being drawn. */
export type TimepointChunkStats = {
  /** The timepoint. */
  index: number;
  /** Chunks the layers want here. */
  wanted: number;
  /** How many of `wanted` have their data. */
  loaded: number;
};

/** Chunk counts for one level of detail of one source. */
export type LodChunkStats = {
  /** The level of detail, `0` being finest. */
  lod: number;
  /** Chunks the layers want at this level. */
  wanted: number;
  /** How many of `wanted` have their data. */
  loaded: number;
};

/** Chunk counts for one source. */
export type SourceChunkStats = {
  /** The source the counts describe. */
  source: ChunkSource;
  /** Chunks the layers want. The budget may defer fetching them. */
  wanted: number;
  /** How many of `wanted` have their data. */
  loaded: number;
  /** Counts per level of detail, finest first. Idle levels are omitted. */
  lods: readonly LodChunkStats[];
  /** Counts per timepoint, covering the whole time axis. */
  timepoints: readonly TimepointChunkStats[];
};

/** A snapshot of what the layers want and how much of it has loaded. */
export type ChunkStats = {
  /** Chunks the layers want, across all sources. */
  wanted: number;
  /** How many of `wanted` have their data. Drawable only once uploaded. */
  loaded: number;
  /** One entry per chunk source, with per-LOD and per-timepoint detail. */
  sources: readonly SourceChunkStats[];
};

/**
 * Derives chunk statistics from the manager's stores.
 *
 * @param stores - The manager's sources and their stores.
 */
export function computeChunkStats(
  stores: readonly { source: ChunkSource; store: ChunkStore }[]
): ChunkStats {
  const sources = stores.map(({ source, store }) =>
    statsForStore(source, store)
  );

  let wanted = 0;
  let loaded = 0;
  for (const stats of sources) {
    wanted += stats.wanted;
    loaded += stats.loaded;
  }

  return { wanted, loaded, sources };
}

function statsForStore(
  source: ChunkSource,
  store: ChunkStore
): SourceChunkStats {
  // multiple views may want the same chunk, so collect before counting
  const wantedChunks = new Map<Chunk, boolean>();
  for (const view of store.views) {
    for (const [chunk, state] of view.chunkViewStates) {
      if (state.priority === null) continue;
      const atCurrentLOD =
        (wantedChunks.get(chunk) ?? false) || chunk.lod === view.currentLOD;
      wantedChunks.set(chunk, atCurrentLOD);
    }
  }

  const numTimePoints = store.dimensions.t?.lods[0].size ?? 1;
  const timepoints: TimepointChunkStats[] = Array.from(
    { length: numTimePoints },
    (_, index) => ({ index, wanted: 0, loaded: 0 })
  );

  const lods = new Map<number, LodChunkStats>();
  const lodEntry = (lod: number): LodChunkStats => {
    let entry = lods.get(lod);
    if (entry === undefined) {
      entry = { lod, wanted: 0, loaded: 0 };
      lods.set(lod, entry);
    }
    return entry;
  };

  let wanted = 0;
  let loaded = 0;

  for (const [chunk, atCurrentLOD] of wantedChunks) {
    const isLoaded = chunk.state === "loaded";
    wanted += 1;
    if (isLoaded) loaded += 1;

    const lod = lodEntry(chunk.lod);
    lod.wanted += 1;
    if (isLoaded) lod.loaded += 1;

    if (!atCurrentLOD) continue;
    const timepoint = timepoints[chunk.chunkIndex.t];
    timepoint.wanted += 1;
    if (isLoaded) timepoint.loaded += 1;
  }

  return {
    source,
    wanted,
    loaded,
    lods: [...lods.values()].sort((a, b) => a.lod - b.lod),
    timepoints,
  };
}
