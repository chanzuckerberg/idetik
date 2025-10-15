import { ChunkSource } from "../data/chunk";
import { ChunkQueue } from "../data/chunk_queue";
import { ChunkStore } from "./chunk_store";
import { Logger } from "../utilities/logger";

export class ChunkManager {
  private readonly sources_ = new Map<ChunkSource, ChunkStore>();
  private readonly pendingSources_ = new Map<
    ChunkSource,
    Promise<ChunkStore>
  >();
  private readonly queue_ = new ChunkQueue();

  public async addSource(source: ChunkSource): Promise<ChunkStore> {
    // Check if already loaded
    const existing = this.sources_.get(source);
    if (existing) {
      Logger.info("ChunkManager", "REUSING existing ChunkStore for source");
      return existing;
    }

    // Check if already being loaded (prevents race condition)
    const pending = this.pendingSources_.get(source);
    if (pending) {
      Logger.info("ChunkManager", "WAITING for pending ChunkStore creation");
      return pending;
    }

    // Create new ChunkStore
    Logger.info("ChunkManager", "Creating NEW ChunkStore for source");
    const promise = (async () => {
      const loader = await source.open();
      const store = new ChunkStore(loader);

      // Store the result and clean up pending
      this.sources_.set(source, store);
      this.pendingSources_.delete(source);

      return store;
    })();

    // Track the pending promise
    this.pendingSources_.set(source, promise);

    return promise;
  }

  /**
   * Update all chunk stores by collecting updated chunks from their views
   * and enqueueing/cancelling them based on priority.
   * This should be called once per frame before rendering.
   */
  public update() {
    for (const store of this.sources_.values()) {
      const updatedChunks = store.consumeUpdatedChunks();

      // Enqueue/cancel chunks based on their priority
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
  }

  /**
   * Process all pending chunk load requests in the queue.
   * This should be called once per frame after all layers have updated.
   */
  public flush() {
    this.queue_.flush();
  }
}
