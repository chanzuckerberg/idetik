import { Chunk, ChunkObserver, ChunkState } from "../data/chunk";

/**
 * Statistics for chunks at a specific (time, LOD) coordinate.
 * All chunk properties are tracked at this granularity.
 */
class ChunkStats {
  total = 0;
  unloaded = 0;
  queued = 0;
  loading = 0;
  loaded = 0;
  visible = 0;
  prefetch = 0;
}

/**
 * Tracks chunk statistics incrementally by observing chunk property changes.
 * This provides O(1) access to statistics instead of O(n) iteration over all chunks.
 *
 * Implements ChunkObserver to automatically receive notifications when
 * chunk properties change (state, visible, prefetch, lod).
 *
 * Storage: stats_[lod][time] = ChunkStats
 * LOD is the outer dimension because different LODs can have different numbers of time points.
 */
export class ChunkStatistics implements ChunkObserver {
  /** Array of LODs, each containing an array of time points */
  private stats_: ChunkStats[][] = [];

  /**
   * Begins tracking a chunk. Registers as an observer and initializes counts.
   * Should be called when a chunk is created.
   */
  trackChunk(chunk: Chunk): void {
    chunk.addObserver(this);

    const stats = this.getOrCreateStats(chunk.chunkIndex.t, chunk.lod);
    stats.total++;
    this.incrementStateCount(stats, chunk.state);

    if (chunk.visible) stats.visible++;
    if (chunk.prefetch) stats.prefetch++;
  }

  /**
   * Stops tracking a chunk. Removes observer and decrements counts.
   */
  untrackChunk(chunk: Chunk): void {
    chunk.removeObserver(this);

    const stats = this.getStats(chunk.chunkIndex.t, chunk.lod);

    // Decrement state count
    this.decrementStateCount(stats, chunk.state);

    // Decrement visibility/prefetch counts
    if (chunk.visible) stats.visible--;
    if (chunk.prefetch) stats.prefetch--;

    // Decrement total count
    stats.total--;
  }

  /**
   * ChunkObserver callback: invoked automatically when chunk state changes.
   */
  onStateChange(
    chunk: Chunk,
    oldState: ChunkState,
    newState: ChunkState
  ): void {
    const stats = this.getOrCreateStats(chunk.chunkIndex.t, chunk.lod);

    this.decrementStateCount(stats, oldState);
    this.incrementStateCount(stats, newState);
  }

  /**
   * ChunkObserver callback: invoked automatically when chunk visibility changes.
   */
  onVisibilityChange(chunk: Chunk, nowVisible: boolean): void {
    const stats = this.getOrCreateStats(chunk.chunkIndex.t, chunk.lod);
    stats.visible += nowVisible ? 1 : -1;
  }

  /**
   * ChunkObserver callback: invoked automatically when chunk prefetch status changes.
   */
  onPrefetchChange(chunk: Chunk, nowPrefetched: boolean): void {
    const stats = this.getOrCreateStats(chunk.chunkIndex.t, chunk.lod);
    stats.prefetch += nowPrefetched ? 1 : -1;
  }

  /**
   * ChunkObserver callback: invoked automatically when chunk LOD changes.
   * Moves all counts from old LOD to new LOD.
   */
  onLODChange(chunk: Chunk, oldLOD: number, newLOD: number): void {
    const oldStats = this.getOrCreateStats(chunk.chunkIndex.t, oldLOD);
    const newStats = this.getOrCreateStats(chunk.chunkIndex.t, newLOD);

    // Move total count
    oldStats.total--;
    newStats.total++;

    // Move state count
    this.decrementStateCount(oldStats, chunk.state);
    this.incrementStateCount(newStats, chunk.state);

    // Move visibility count
    if (chunk.visible) {
      oldStats.visible--;
      newStats.visible++;
    }

    // Move prefetch count
    if (chunk.prefetch) {
      oldStats.prefetch--;
      newStats.prefetch++;
    }
  }

  /**
   * Gets statistics for a specific (time, LOD) coordinate.
   * Returns the ChunkStats object directly (not a copy).
   */
  getStats(timeIndex: number, lod: number): ChunkStats {
    const lodArray = this.stats_[lod];
    if (!lodArray) {
      // Return empty stats if LOD not tracked
      return new ChunkStats();
    }

    const stats = lodArray[timeIndex];
    if (!stats) {
      // Return empty stats if time not tracked at this LOD
      return new ChunkStats();
    }

    return stats;
  }

  private getOrCreateStats(timeIndex: number, lod: number): ChunkStats {
    // Ensure LOD array exists
    if (!this.stats_[lod]) {
      this.stats_[lod] = [];
    }

    const lodArray = this.stats_[lod];

    // Ensure stats object exists at this time index
    if (!lodArray[timeIndex]) {
      lodArray[timeIndex] = new ChunkStats();
    }

    return lodArray[timeIndex];
  }

  private incrementStateCount(stats: ChunkStats, state: ChunkState): void {
    switch (state) {
      case "unloaded":
        stats.unloaded++;
        break;
      case "queued":
        stats.queued++;
        break;
      case "loading":
        stats.loading++;
        break;
      case "loaded":
        stats.loaded++;
        break;
    }
  }

  private decrementStateCount(stats: ChunkStats, state: ChunkState): void {
    switch (state) {
      case "unloaded":
        stats.unloaded--;
        break;
      case "queued":
        stats.queued--;
        break;
      case "loading":
        stats.loading--;
        break;
      case "loaded":
        stats.loaded--;
        break;
    }
  }
}
