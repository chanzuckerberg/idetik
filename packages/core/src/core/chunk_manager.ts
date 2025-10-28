import { Chunk, ChunkSource } from "../data/chunk";
import { ChunkQueue } from "../data/chunk_queue";
import { ChunkStore } from "./chunk_store";
import { ChunkStoreView } from "./chunk_store_view";
import { ImageSourcePolicy } from "./image_source_policy";

export class ChunkManager {
  private readonly stores_ = new Map<ChunkSource, ChunkStore>();
  private readonly pendingStores_ = new Map<ChunkSource, Promise<ChunkStore>>();
  private readonly views_ = new Map<ChunkStore, ChunkStoreView[]>();
  private readonly queue_ = new ChunkQueue();

  public async addView(
    source: ChunkSource,
    policy: ImageSourcePolicy
  ): Promise<ChunkStoreView> {
    const store = await this.addSource(source);
    const view = new ChunkStoreView(store, policy);
    this.views_.set(store, (this.views_.get(store) ?? []).concat(view));
    return view;
  }

  public removeView(view: ChunkStoreView): void {
    // TODO: log or throw if store or view is not found
    const store = view.store;
    const views = this.views_.get(store);
    if (!views) return;
    const index = views.indexOf(view);
    if (index === -1) return;

    const affectedChunks = Array.from(view.chunkViewStates.keys());

    views.splice(index, 1);

    for (const chunk of affectedChunks) {
      this.aggregateChunkViewStates(chunk, store);
    }

    if (views.length === 0) {
      const source = this.getSourceForStore(store);
      this.stores_.delete(source);
      this.views_.delete(store);
    }
  }

  private async addSource(source: ChunkSource): Promise<ChunkStore> {
    const existingOrPending =
      this.stores_.get(source) ?? this.pendingStores_.get(source);
    if (existingOrPending) {
      return existingOrPending;
    }

    const initializeStore = async () => {
      const loader = await source.open();
      const store = new ChunkStore(loader);
      this.stores_.set(source, store);
      this.pendingStores_.delete(source);
      return store;
    };

    const pending = initializeStore();
    this.pendingStores_.set(source, pending);
    return pending;
  }

  private getSourceForStore(store: ChunkStore): ChunkSource {
    for (const [source, s] of this.stores_) {
      if (s === store) {
        return source;
      }
    }
    throw new Error("Source not found for the given store.");
  }

  public update() {
    for (const [_, store] of this.stores_) {
      const updatedChunks = this.updateAndCollectChunkChanges(store);

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

  private updateAndCollectChunkChanges(store: ChunkStore): Set<Chunk> {
    const views = this.views_.get(store);
    if (!views) return new Set<Chunk>();
    const affectedChunks = new Set<Chunk>();
    for (const view of views) {
      for (const [chunk, _viewState] of view.chunkViewStates) {
        affectedChunks.add(chunk);
      }
    }

    for (const chunk of affectedChunks) {
      this.aggregateChunkViewStates(chunk, store);
    }

    return affectedChunks;
  }

  private aggregateChunkViewStates(chunk: Chunk, store: ChunkStore): void {
    const views = this.views_.get(store);
    if (!views) return;
    let anyVisible = false;
    let anyPrefetch = false;
    let minPriority: number | null = null;
    let orderKeyForMinPriority: number | null = null;

    for (const view of views) {
      const viewState = view.chunkViewStates.get(chunk);
      if (!viewState) continue;

      if (viewState.visible) anyVisible = true;
      if (viewState.prefetch) anyPrefetch = true;

      if (viewState.priority !== null) {
        if (minPriority === null || viewState.priority < minPriority) {
          minPriority = viewState.priority;
          orderKeyForMinPriority = viewState.orderKey;
        }
      }

      if (
        !viewState.visible &&
        !viewState.prefetch &&
        viewState.priority === null
      ) {
        view.maybeForgetChunk(chunk);
      }
    }

    chunk.visible = anyVisible;
    chunk.prefetch = anyPrefetch;
    chunk.priority = minPriority;
    chunk.orderKey = orderKeyForMinPriority;

    if (chunk.priority !== null && chunk.state === "unloaded") {
      chunk.state = "queued";
    } else if (chunk.priority === null && chunk.state === "queued") {
      chunk.state = "unloaded";
    }

    if (chunk.priority === null && chunk.state === "loaded") {
      store.disposeChunk(chunk);
    }
  }
}
