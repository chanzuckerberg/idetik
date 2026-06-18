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
  private readonly stores_ = new Map<ChunkSource, ChunkStore>();
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
    let store = this.stores_.get(source);
    if (!store) {
      store = new ChunkStore(source.getLoader());
      this.stores_.set(source, store);
    }
    return store.addView(policy);
  }

  public update() {
    for (const [_, store] of this.stores_) {
      const updatedChunks = store.updateAndCollectChunkChanges();

      for (const chunk of updatedChunks) {
        if (chunk.priority === null) {
          this.queue_.cancel(chunk);
        } else if (chunk.state === "queued") {
          this.queue_.enqueue(chunk, (signal) =>
            store.loadChunkData(chunk, signal)
          );
        }
      }
    }

    this.queue_.flush();

    for (const [source, store] of this.stores_) {
      if (store.canDispose()) {
        this.stores_.delete(source);
      }
    }
  }
}
