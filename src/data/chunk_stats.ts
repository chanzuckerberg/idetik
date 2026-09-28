import { Chunk, ChunkSource } from "./chunk";
import type { ChunkStore } from "./chunk_store";
import type { ChunkStoreView } from "./chunk_store_view";

/**
 * A snapshot of chunk demand and GPU residency.
 *
 * Requested counts include prefetch. When the memory limit cannot hold every
 * requested chunk, some are never fetched and `resident` stays below
 * `requested`.
 */
export type ChunkStats = {
  /** Cache state per source, combined across all of its views. */
  sources: readonly {
    /** The source the counts describe. */
    source: ChunkSource;
    /**
     * Chunks requested by any view, visible or prefetch, at any LOD. A chunk
     * requested by several views counts once. The budget may defer fetching.
     */
    requested: number;
    /** How many of `requested` are on the GPU and drawable. */
    resident: number;
    /** Counts per level of detail, finest first, covering every level. */
    lods: readonly {
      /** The level of detail, `0` being finest. */
      lod: number;
      /** Chunks at this level requested by any view. */
      requested: number;
      /** How many of `requested` are on the GPU. */
      resident: number;
    }[];
  }[];
  /**
   * Loading progress per viewport, summed across its chunked layers.
   * Viewports without chunked layers are omitted.
   */
  viewports: readonly {
    /** The viewport the counts describe. */
    viewportId: string;
    /**
     * Visible and prefetch chunks at any LOD, including the fallback LOD
     * drawn while the current one loads.
     */
    requested: number;
    /** How many of `requested` are on the GPU. */
    resident: number;
    /**
     * Visible and prefetch chunks, indexed by timepoint and covering the
     * longest time axis among the viewport's sources.
     */
    timepoints: {
      /** Chunks requested at each timepoint. */
      requested: Uint32Array;
      /** How many of `requested` are on the GPU at each timepoint. */
      resident: Uint32Array;
    };
  }[];
};

type SourceChunkStats = ChunkStats["sources"][number];
type ViewportChunkStats = ChunkStats["viewports"][number];
type LodChunkStats = SourceChunkStats["lods"][number];

/**
 * Counts one source's chunks across all of its views.
 *
 * @param source - The source the store holds.
 * @param store - The store to count.
 */
export function computeSourceChunkStats(
  source: ChunkSource,
  store: ChunkStore
): SourceChunkStats {
  const lods: LodChunkStats[] = [];
  for (let lod = 0; lod < store.lodCount; lod++) {
    lods.push({ lod, requested: 0, resident: 0 });
  }

  let requested = 0;
  let resident = 0;

  const views = store.views;
  for (let i = 0; i < views.length; i++) {
    for (const [chunk, state] of views[i].chunkViewStates) {
      if (state.priority === null) continue;
      if (isRequestedByEarlierView(chunk, views, i)) continue;

      const isResident = chunk.texture !== undefined;
      requested += 1;
      lods[chunk.lod].requested += 1;
      if (isResident) {
        resident += 1;
        lods[chunk.lod].resident += 1;
      }
    }
  }

  return { source, requested, resident, lods };
}

// avoids allocating a set per call to count chunks shared by views once
function isRequestedByEarlierView(
  chunk: Chunk,
  views: ReadonlyArray<ChunkStoreView>,
  index: number
): boolean {
  for (let i = 0; i < index; i++) {
    const state = views[i].chunkViewStates.get(chunk);
    if (state !== undefined && state.priority !== null) return true;
  }
  return false;
}

/**
 * Sums the chunks requested by a viewport's views.
 *
 * @param viewportId - The viewport the views render into.
 * @param views - The viewport's views and the stores they belong to.
 */
export function computeViewportChunkStats(
  viewportId: string,
  views: readonly { store: ChunkStore; view: ChunkStoreView }[]
): ViewportChunkStats {
  let numTimepoints = 1;
  for (const { store } of views) {
    numTimepoints = Math.max(
      numTimepoints,
      store.dimensions.t?.lods[0].size ?? 1
    );
  }
  const timepoints = {
    requested: new Uint32Array(numTimepoints),
    resident: new Uint32Array(numTimepoints),
  };

  let requested = 0;
  let resident = 0;

  for (const { view } of views) {
    for (const [chunk, state] of view.chunkViewStates) {
      if (state.priority === null) continue;

      const t = chunk.chunkIndex.t;
      requested += 1;
      timepoints.requested[t] += 1;
      if (chunk.texture !== undefined) {
        resident += 1;
        timepoints.resident[t] += 1;
      }
    }
  }

  return { viewportId, requested, resident, timepoints };
}
