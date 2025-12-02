import { ChunkSource } from "../data/chunk";
import { ChunkQueue } from "../data/chunk_queue";
import { ChunkStore } from "./chunk_store";
import { ChunkStoreView } from "./chunk_store_view";
import { ImageSourcePolicy } from "./image_source_policy";

export class ChunkManager {
  private readonly stores_ = new Map<ChunkSource, ChunkStore>();
  private readonly pendingStores_ = new Map<ChunkSource, Promise<ChunkStore>>();
  private readonly queue_ = new ChunkQueue();

  public async addView(
    source: ChunkSource,
    policy: ImageSourcePolicy
  ): Promise<ChunkStoreView> {
    const store = await this.getOrCreateStore(source);
    const view = new ChunkStoreView(store, policy);
    store.addView(view);

    if (store.views.length === 1) {
      this.stores_.set(source, store);
      this.pendingStores_.delete(source);
    }

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
    return newPending;
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
      if (store.views.length === 0) {
        this.stores_.delete(source);
      }
    }
  }
}
