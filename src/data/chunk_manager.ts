import { ChunkSource } from "./chunk";
import { ChunkQueue } from "./chunk_queue";
import { chunkMemoryStats } from "./chunk_memory";

export type QueueStats = {
  pending: number;
  running: number;
};
import { ChunkStore } from "./chunk_store";
import { ChunkStoreView } from "./chunk_store_view";
import { ImageSourcePolicy } from "../core/image_source_policy";

export class ChunkManager {
  private readonly stores_: { source: ChunkSource; store: ChunkStore }[] = [];
  private readonly queue_ = new ChunkQueue();

  public get queueStats(): QueueStats {
    return {
      pending: this.queue_.pendingCount,
      running: this.queue_.runningCount,
    };
  }

  public get memoryStats() {
    return chunkMemoryStats();
  }

  public addView(
    source: ChunkSource,
    policy: ImageSourcePolicy
  ): ChunkStoreView {
    let store = this.stores_.find((s) => s.source === source)?.store;
    if (!store) {
      store = new ChunkStore(source.loader.getSourceDimensionMap());
      this.stores_.push({ source, store });
    }
    return store.addView(policy);
  }

  public update() {
    for (const { source, store } of this.stores_) {
      const updatedChunks = store.updateAndCollectChunkChanges();

      for (const chunk of updatedChunks) {
        if (chunk.priority === null) {
          this.queue_.cancel(chunk);
        } else if (chunk.state === "queued") {
          this.queue_.enqueue(chunk, (signal) =>
            source.loader.loadChunkData(chunk, signal)
          );
        }
      }
    }

    this.queue_.flush();

    for (let i = this.stores_.length - 1; i >= 0; i--) {
      if (this.stores_[i].store.canDispose()) {
        this.stores_.splice(i, 1);
      }
    }
  }
}
