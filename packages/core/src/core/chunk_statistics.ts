import { Chunk, ChunkObserver, ChunkState } from "../data/chunk";

class ChunkStats {
  total = 0;
  unloaded = 0;
  queued = 0;
  loading = 0;
  loaded = 0;
  visible = 0;
  prefetch = 0;
}

export class ChunkStatistics implements ChunkObserver {
  // Outer dimension is LOD, inner dimension is time.
  private stats_: ChunkStats[][] = [];

  trackChunk(chunk: Chunk): void {
    chunk.addObserver(this);
    const stats = this.getOrCreateStats(chunk.chunkIndex.t, chunk.lod);
    stats.total++;
    this.incrementStateCount(stats, chunk.state);
    if (chunk.visible) stats.visible++;
    if (chunk.prefetch) stats.prefetch++;
  }

  untrackChunk(chunk: Chunk): void {
    chunk.removeObserver(this);
    const stats = this.getStats(chunk.chunkIndex.t, chunk.lod);
    this.decrementStateCount(stats, chunk.state);
    if (chunk.visible) stats.visible--;
    if (chunk.prefetch) stats.prefetch--;
    stats.total--;
  }

  allPrefetchLoaded(timeIndex: number, lod: number): boolean {
    const stats = this.stats_[lod][timeIndex];
    if (!stats) return false;
    return stats.prefetch === stats.loaded;
  }

  allVisibleLoaded(timeIndex: number, lod: number): boolean {
    const stats = this.stats_[lod][timeIndex];
    if (!stats) return false;
    return stats.visible === stats.loaded;
  }

  onStateChange(
    chunk: Chunk,
    oldState: ChunkState,
    newState: ChunkState
  ): void {
    const stats = this.getOrCreateStats(chunk.chunkIndex.t, chunk.lod);
    this.decrementStateCount(stats, oldState);
    this.incrementStateCount(stats, newState);
  }

  onVisibilityChange(chunk: Chunk, nowVisible: boolean): void {
    const stats = this.getOrCreateStats(chunk.chunkIndex.t, chunk.lod);
    stats.visible += nowVisible ? 1 : -1;
  }

  onPrefetchChange(chunk: Chunk, nowPrefetched: boolean): void {
    const stats = this.getOrCreateStats(chunk.chunkIndex.t, chunk.lod);
    stats.prefetch += nowPrefetched ? 1 : -1;
  }

  getStats(timeIndex: number, lod: number): ChunkStats {
    const lodArray = this.stats_[lod];
    if (!lodArray) return new ChunkStats();
    const stats = lodArray[timeIndex];
    if (!stats) return new ChunkStats();
    return stats;
  }

  private getOrCreateStats(timeIndex: number, lod: number): ChunkStats {
    if (!this.stats_[lod]) {
      this.stats_[lod] = [];
    }
    const lodArray = this.stats_[lod];
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
