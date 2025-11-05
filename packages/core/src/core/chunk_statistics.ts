import { Chunk, ChunkObserver, ChunkState } from "../data/chunk";

/**
 * Statistics for chunks at a specific LOD (Level of Detail).
 */
export interface LODStats {
  /** Number of visible chunks at this LOD */
  visibleChunks: number;
  /** Number of prefetched chunks at this LOD */
  prefetchedChunks: number;
}

/**
 * Statistics for all chunks at a specific time index.
 */
export interface TimeIndexStats {
  /** Total number of chunks at this time index */
  totalChunks: number;

  /** Number of chunks in "unloaded" state */
  unloadedChunks: number;
  /** Number of chunks in "queued" state */
  queuedChunks: number;
  /** Number of chunks in "loading" state */
  loadingChunks: number;
  /** Number of chunks in "loaded" state */
  loadedChunks: number;

  /** Per-LOD breakdown of statistics */
  perLOD: ReadonlyMap<number, LODStats>;
}

/**
 * Mutable internal representation of LOD statistics.
 */
class LODStatsImpl implements LODStats {
  visibleChunks = 0;
  prefetchedChunks = 0;

  clone(): LODStatsImpl {
    const cloned = new LODStatsImpl();
    cloned.visibleChunks = this.visibleChunks;
    cloned.prefetchedChunks = this.prefetchedChunks;
    return cloned;
  }
}

/**
 * Mutable internal representation of time index statistics.
 */
class TimeIndexStatsImpl implements TimeIndexStats {
  totalChunks = 0;
  unloadedChunks = 0;
  queuedChunks = 0;
  loadingChunks = 0;
  loadedChunks = 0;
  private perLODMap_ = new Map<number, LODStatsImpl>();

  get perLOD(): ReadonlyMap<number, LODStats> {
    return this.perLODMap_;
  }

  getOrCreateLODStats(lod: number): LODStatsImpl {
    let lodStats = this.perLODMap_.get(lod);
    if (!lodStats) {
      lodStats = new LODStatsImpl();
      this.perLODMap_.set(lod, lodStats);
    }
    return lodStats;
  }

  getLODStats(lod: number): LODStatsImpl | undefined {
    return this.perLODMap_.get(lod);
  }

  clone(): TimeIndexStatsImpl {
    const cloned = new TimeIndexStatsImpl();
    cloned.totalChunks = this.totalChunks;
    cloned.unloadedChunks = this.unloadedChunks;
    cloned.queuedChunks = this.queuedChunks;
    cloned.loadingChunks = this.loadingChunks;
    cloned.loadedChunks = this.loadedChunks;
    for (const [lod, lodStats] of this.perLODMap_) {
      cloned.perLODMap_.set(lod, lodStats.clone());
    }
    return cloned;
  }
}

/**
 * Tracks chunk statistics incrementally by observing chunk property changes.
 * This provides O(1) access to statistics instead of O(n) iteration over all chunks.
 *
 * Implements ChunkObserver to automatically receive notifications when
 * chunk properties change (state, visible, prefetch, lod).
 */
export class ChunkStatistics implements ChunkObserver {
  /** Statistics per time index */
  private perTimeStats_ = new Map<number, TimeIndexStatsImpl>();

  /**
   * Begins tracking a chunk. Registers as an observer and initializes counts.
   * Should be called when a chunk is created.
   */
  trackChunk(chunk: Chunk): void {
    chunk.addObserver(this);

    const timeStats = this.getOrCreateTimeStats(chunk.chunkIndex.t);
    timeStats.totalChunks++;
    this.incrementStateCount(timeStats, chunk.state);

    // Initialize visibility/prefetch counts if applicable
    if (chunk.visible) {
      const lodStats = timeStats.getOrCreateLODStats(chunk.lod);
      lodStats.visibleChunks++;
    }
    if (chunk.prefetch) {
      const lodStats = timeStats.getOrCreateLODStats(chunk.lod);
      lodStats.prefetchedChunks++;
    }
  }

  /**
   * Stops tracking a chunk. Removes observer and decrements counts.
   */
  untrackChunk(chunk: Chunk): void {
    chunk.removeObserver(this);

    const timeStats = this.perTimeStats_.get(chunk.chunkIndex.t);
    if (!timeStats) {
      return;
    }

    // Decrement state counts
    this.decrementStateCount(timeStats, chunk.state);

    // Decrement visibility/prefetch counts
    if (chunk.visible || chunk.prefetch) {
      const lodStats = timeStats.getLODStats(chunk.lod);
      if (lodStats) {
        if (chunk.visible) {
          lodStats.visibleChunks--;
        }
        if (chunk.prefetch) {
          lodStats.prefetchedChunks--;
        }
      }
    }

    // Decrement total count
    timeStats.totalChunks--;
  }

  /**
   * ChunkObserver callback: invoked automatically when chunk state changes.
   */
  onStateChange(
    chunk: Chunk,
    oldState: ChunkState,
    newState: ChunkState
  ): void {
    const timeStats = this.getOrCreateTimeStats(chunk.chunkIndex.t);

    // Decrement old state count
    this.decrementStateCount(timeStats, oldState);

    // Increment new state count
    this.incrementStateCount(timeStats, newState);
  }

  /**
   * ChunkObserver callback: invoked automatically when chunk visibility changes.
   */
  onVisibilityChange(chunk: Chunk, nowVisible: boolean): void {
    const timeStats = this.getOrCreateTimeStats(chunk.chunkIndex.t);
    const lodStats = timeStats.getOrCreateLODStats(chunk.lod);

    if (nowVisible) {
      lodStats.visibleChunks++;
    } else {
      lodStats.visibleChunks--;
    }
  }

  /**
   * ChunkObserver callback: invoked automatically when chunk prefetch status changes.
   */
  onPrefetchChange(chunk: Chunk, nowPrefetched: boolean): void {
    const timeStats = this.getOrCreateTimeStats(chunk.chunkIndex.t);
    const lodStats = timeStats.getOrCreateLODStats(chunk.lod);

    if (nowPrefetched) {
      lodStats.prefetchedChunks++;
    } else {
      lodStats.prefetchedChunks--;
    }
  }

  /**
   * ChunkObserver callback: invoked automatically when chunk LOD changes.
   * Updates the per-LOD statistics by moving the chunk from one LOD to another.
   */
  onLODChange(chunk: Chunk, oldLOD: number, newLOD: number): void {
    const timeStats = this.getOrCreateTimeStats(chunk.chunkIndex.t);
    const oldLodStats = timeStats.getOrCreateLODStats(oldLOD);
    const newLodStats = timeStats.getOrCreateLODStats(newLOD);

    // Move visibility count
    if (chunk.visible) {
      oldLodStats.visibleChunks--;
      newLodStats.visibleChunks++;
    }

    // Move prefetch count
    if (chunk.prefetch) {
      oldLodStats.prefetchedChunks--;
      newLodStats.prefetchedChunks++;
    }
  }

  /**
   * Disposes all statistics for a specific time index.
   * Should be called when an entire time index is no longer tracked.
   */
  disposeTimeIndex(timeIndex: number): void {
    this.perTimeStats_.delete(timeIndex);
  }

  /**
   * Gets statistics for a specific time index.
   * Returns a snapshot of the statistics.
   */
  getStatsForTime(timeIndex: number): TimeIndexStats {
    const stats = this.perTimeStats_.get(timeIndex);
    if (!stats) {
      // Return empty stats if time index not tracked
      return {
        totalChunks: 0,
        unloadedChunks: 0,
        queuedChunks: 0,
        loadingChunks: 0,
        loadedChunks: 0,
        perLOD: new Map(),
      };
    }
    return stats.clone();
  }

  /**
   * Gets all tracked time indices.
   */
  getTrackedTimeIndices(): ReadonlySet<number> {
    return new Set(this.perTimeStats_.keys());
  }

  private getOrCreateTimeStats(timeIndex: number): TimeIndexStatsImpl {
    let timeStats = this.perTimeStats_.get(timeIndex);
    if (!timeStats) {
      timeStats = new TimeIndexStatsImpl();
      this.perTimeStats_.set(timeIndex, timeStats);
    }
    return timeStats;
  }

  private incrementStateCount(
    timeStats: TimeIndexStatsImpl,
    state: ChunkState
  ): void {
    switch (state) {
      case "unloaded":
        timeStats.unloadedChunks++;
        break;
      case "queued":
        timeStats.queuedChunks++;
        break;
      case "loading":
        timeStats.loadingChunks++;
        break;
      case "loaded":
        timeStats.loadedChunks++;
        break;
    }
  }

  private decrementStateCount(
    timeStats: TimeIndexStatsImpl,
    state: ChunkState
  ): void {
    switch (state) {
      case "unloaded":
        timeStats.unloadedChunks--;
        break;
      case "queued":
        timeStats.queuedChunks--;
        break;
      case "loading":
        timeStats.loadingChunks--;
        break;
      case "loaded":
        timeStats.loadedChunks--;
        break;
    }
  }
}
