import { ChunkSource, SliceCoordinates } from "../data/chunk";
import { OrthographicCamera } from "../objects/cameras/orthographic_camera";
import { ChunkQueue } from "../data/chunk_queue";
import { ChunkManagerSource } from "./chunk_manager_source";
import { ImageSourcePolicy } from "./image_source_policy";

export class ChunkManager {
  private readonly sources_ = new Map<ChunkSource, ChunkManagerSource>();
  private readonly pendingSources_ = new Map<
    ChunkSource,
    Promise<ChunkManagerSource>
  >();
  private readonly chunkToSource_ = new Map<
    import("../data/chunk").Chunk,
    ChunkManagerSource
  >();
  private readonly queue_ = new ChunkQueue(8, (chunk, oldState, newState) => {
    const source = this.chunkToSource_.get(chunk);
    if (source) {
      source.statistics.recordStateTransition(chunk, oldState, newState);
    }
  });

  public async addSource(
    source: ChunkSource,
    sliceCoords: SliceCoordinates,
    policy: ImageSourcePolicy
  ) {
    const existingOrPending =
      this.sources_.get(source) ?? this.pendingSources_.get(source);
    if (existingOrPending) {
      return existingOrPending;
    }

    const initializeSource = async () => {
      const loader = await source.open();
      const chunkManagerSource = new ChunkManagerSource(
        loader,
        sliceCoords,
        policy
      );
      this.sources_.set(source, chunkManagerSource);
      this.pendingSources_.delete(source);
      return chunkManagerSource;
    };

    const pending = initializeSource();
    this.pendingSources_.set(source, pending);
    return pending;
  }

  public update(camera: OrthographicCamera, bufferWidth: number) {
    if (this.sources_.size === 0) return;

    if (camera.type !== "OrthographicCamera") {
      throw new Error(
        "ChunkManager currently supports only orthographic cameras. " +
          "Update the implementation before using a perspective camera."
      );
    }

    const viewBounds2D = camera.getWorldViewRect();
    const virtualWidth = Math.abs(viewBounds2D.max[0] - viewBounds2D.min[0]);
    const virtualUnitsPerScreenPixel = virtualWidth / bufferWidth;
    const lodFactor = Math.log2(1 / virtualUnitsPerScreenPixel);

    for (const [_, source] of this.sources_) {
      const updatedChunks = source.updateAndCollectChunkChanges(
        lodFactor,
        viewBounds2D
      );
      for (const chunk of updatedChunks) {
        if (chunk.priority === null) {
          this.queue_.cancel(chunk);
          this.chunkToSource_.delete(chunk);
        } else if (chunk.state === "queued") {
          this.chunkToSource_.set(chunk, source);
          this.queue_.enqueue(chunk, (signal) =>
            source.loadChunkData(chunk, signal)
          );
        }
      }
    }

    this.queue_.flush();
  }

  /**
   * Gets aggregate statistics across all sources.
   * Returns aggregate counts summed across all sources.
   */
  public getAggregateStatistics(): import("./chunk_statistics").AggregateStats {
    const aggregated: import("./chunk_statistics").AggregateStats = {
      totalChunks: 0,
      unloadedChunks: 0,
      queuedChunks: 0,
      loadingChunks: 0,
      loadedChunks: 0,
    };

    for (const [_, source] of this.sources_) {
      const stats = source.statistics.getAggregateStats();
      aggregated.totalChunks += stats.totalChunks;
      aggregated.unloadedChunks += stats.unloadedChunks;
      aggregated.queuedChunks += stats.queuedChunks;
      aggregated.loadingChunks += stats.loadingChunks;
      aggregated.loadedChunks += stats.loadedChunks;
    }

    return aggregated;
  }

  /**
   * Gets all chunk manager sources.
   * Useful for accessing per-source statistics.
   */
  public getSources(): ReadonlyArray<ChunkManagerSource> {
    return Array.from(this.sources_.values());
  }
}
