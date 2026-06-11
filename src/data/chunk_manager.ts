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
import { Logger } from "../utilities/logger";

export class ChunkManager {
  private readonly stores_ = new Map<ChunkSource, ChunkStore>();
  private readonly pendingStores_ = new Map<ChunkSource, Promise<ChunkStore>>();
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

  public async addView(
    source: ChunkSource,
    policy: ImageSourcePolicy
  ): Promise<ChunkStoreView> {
    const store = await this.getOrCreateStore(source);
    const view = store.createView(policy);
    return view;
  }

  private async getOrCreateStore(source: ChunkSource): Promise<ChunkStore> {
    const existing = this.stores_.get(source);
    if (existing) {
      return existing;
    }

    const pending = this.pendingStores_.get(source);
    if (pending) {
      return pending;
    }

    const initializeStore = async () => {
      const loader = await source.open();
      return new ChunkStore(loader);
    };

    const newPending = initializeStore();
    this.pendingStores_.set(source, newPending);

    try {
      const store = await newPending;
      this.stores_.set(source, store);
      return store;
    } catch (error) {
      Logger.error(
        "ChunkManager",
        `Failed to open chunk source: ${String(error)}`
      );
      throw error;
    } finally {
      this.pendingStores_.delete(source);
    }
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
