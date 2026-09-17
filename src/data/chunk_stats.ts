import { Chunk, ChunkSource } from "./chunk";
import type { ChunkStore } from "./chunk_store";

/** Counts at one timepoint, for the level of detail being drawn. */
export type ResidencyBucket = {
  /** The timepoint. */
  index: number;
  /** Chunks the layers want here. */
  wanted: number;
  /** How many of those are loaded. */
  loaded: number;
};

/** Chunk counts for one level of detail of one source. */
export type LodChunkStats = {
  /** The level of detail, `0` being finest. */
  lod: number;
  /** What the layers are asking for at this level. */
  demand: {
    /** Chunks the layers want. */
    wanted: number;
    /** How many of those are loaded. */
    loaded: number;
  };
};

/** Chunk counts for one source. */
export type SourceChunkStats = {
  /** The source the counts describe. */
  source: ChunkSource;
  /** What the layers are asking for. */
  demand: {
    /** Chunks the layers want. The budget may defer fetching them. */
    wanted: number;
    /** How many of those are loaded. */
    loaded: number;
  };
  /** Counts per level of detail, finest first. Idle levels are omitted. */
  lods: readonly LodChunkStats[];
  /** Counts per timepoint, covering the whole time axis. */
  timepoints: readonly ResidencyBucket[];
};

/** A snapshot of what the layers want and how much of it has loaded. */
export type ChunkStats = {
  /** Demand summed across sources. */
  demand: {
    /** Chunks the layers want. The budget may defer fetching them. */
    wanted: number;
    /** How many of those are loaded. Loaded is not yet drawable. */
    loaded: number;
  };
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

  const demand = { wanted: 0, loaded: 0 };
  for (const stats of sources) {
    demand.wanted += stats.demand.wanted;
    demand.loaded += stats.demand.loaded;
  }

  return { demand, sources };
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
  const timepoints: ResidencyBucket[] = Array.from(
    { length: numTimePoints },
    (_, index) => ({ index, wanted: 0, loaded: 0 })
  );

  const lods = new Map<number, LodChunkStats>();
  const lodEntry = (lod: number): LodChunkStats => {
    let entry = lods.get(lod);
    if (entry === undefined) {
      entry = { lod, demand: { wanted: 0, loaded: 0 } };
      lods.set(lod, entry);
    }
    return entry;
  };

  const demand = { wanted: 0, loaded: 0 };

  for (const [chunk, atCurrentLOD] of wantedChunks) {
    const isLoaded = chunk.state === "loaded";
    demand.wanted += 1;
    if (isLoaded) demand.loaded += 1;

    const lod = lodEntry(chunk.lod).demand;
    lod.wanted += 1;
    if (isLoaded) lod.loaded += 1;

    if (!atCurrentLOD) continue;
    const bucket = timepoints[chunk.chunkIndex.t];
    bucket.wanted += 1;
    if (isLoaded) bucket.loaded += 1;
  }

  return {
    source,
    demand,
    lods: [...lods.values()].sort((a, b) => a.lod - b.lod),
    timepoints,
  };
}
