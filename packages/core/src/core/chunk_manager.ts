import { ChunkSource } from "../data/chunk";
import { ChunkQueue } from "../data/chunk_queue";
import { ChunkStore } from "./chunk_store";

export class ChunkManager {
  private readonly stores_ = new Map<ChunkSource, ChunkStore>();
  private readonly pendingSources_ = new Map<
    ChunkSource,
    Promise<ChunkStore>
  >();
  private readonly queue_ = new ChunkQueue();

  public async addSource(source: ChunkSource): Promise<ChunkStore> {
    const existingOrPending =
      this.stores_.get(source) ?? this.pendingSources_.get(source);
    if (existingOrPending) {
      return existingOrPending;
    }

    const initializeSource = async () => {
      const loader = await source.open();
      const store = new ChunkStore(loader);
      this.stores_.set(source, store);
      this.pendingSources_.delete(source);
      return store;
    };

    const pending = initializeSource();
    this.pendingSources_.set(source, pending);
    return pending;
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
  }
}
