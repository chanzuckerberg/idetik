import { ChunkSource } from "../data/chunk";
import { ChunkQueue } from "../data/chunk_queue";
import { ChunkStore } from "./chunk_store";

export class ChunkManager {
  private readonly sources_ = new Map<ChunkSource, ChunkStore>();
  private readonly queue_ = new ChunkQueue();

  public async addSource(source: ChunkSource) {
    let existing = this.sources_.get(source);
    if (!existing) {
      const loader = await source.open();
      existing = new ChunkStore(loader);
      this.sources_.set(source, existing);
    }
    return existing;
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
      for (const { chunk, sliceCoords } of updatedChunks) {
        if (chunk.priority === null) {
          this.queue_.cancel(chunk);
        } else if (chunk.state === "queued") {
          this.queue_.enqueue(chunk, (signal) =>
            store.loadChunkData(chunk, sliceCoords, signal)
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
