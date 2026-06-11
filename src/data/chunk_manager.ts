import { Chunk, ChunkSource } from "./chunk";
import { ChunkQueue } from "./chunk_queue";
import { chunkMemoryStats } from "./chunk_memory";

export type QueueStats = {
  pending: number;
  running: number;
};
import { ChunkStore } from "./chunk_store";
import { ChunkStoreView } from "./chunk_store_view";
import { ImageSourcePolicy } from "../core/image_source_policy";
import type { Texture } from "../objects/textures/texture";
import { Texture3D } from "../objects/textures/texture_3d";

const DEFAULT_MAX_UPLOADS_PER_UPDATE = 4;

// Most-wanted first: ascending priority, then ascending orderKey — same
// ordering the load queue uses. Null priority sorts last.
function compareByPriority(a: Chunk, b: Chunk): number {
  const pa = a.priority ?? Number.MAX_SAFE_INTEGER;
  const pb = b.priority ?? Number.MAX_SAFE_INTEGER;
  if (pa === pb) {
    return (
      (a.orderKey ?? Number.MAX_SAFE_INTEGER) -
      (b.orderKey ?? Number.MAX_SAFE_INTEGER)
    );
  }
  return pa - pb;
}

export class ChunkManager {
  private readonly stores_ = new Map<ChunkSource, ChunkStore>();
  private readonly pendingStores_ = new Map<ChunkSource, Promise<ChunkStore>>();
  private readonly queue_ = new ChunkQueue();
  // Move chunk voxel data to/from GPU storage outside the draw path. Injected
  // as plain functions (rather than depending on the renderer) so the data
  // layer stays decoupled. When absent, chunks stay CPU-resident and rendering
  // uploads them lazily at bind time (legacy behavior).
  private readonly uploadTexture_?: (texture: Texture) => void;
  private readonly disposeTexture_?: (texture: Texture) => void;

  // Max chunk textures uploaded per update() tick. Bounds synchronous GL upload
  // time per frame so upload bursts don't starve the load pipeline's main-thread
  // completion step. Tunable for the GPU-residency experiment.
  public maxUploadsPerUpdate = DEFAULT_MAX_UPLOADS_PER_UPDATE;

  constructor(
    uploadTexture?: (texture: Texture) => void,
    disposeTexture?: (texture: Texture) => void
  ) {
    this.uploadTexture_ = uploadTexture;
    this.disposeTexture_ = disposeTexture;
  }

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
    policy: ImageSourcePolicy,
    rendersFromGpu = false
  ): Promise<ChunkStoreView> {
    const store = await this.getOrCreateStore(source);
    const view = store.createView(policy, rendersFromGpu);
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

    const store = await newPending;
    this.stores_.set(source, store);
    this.pendingStores_.delete(source);

    return store;
  }

  public update() {
    for (const [_, store] of this.stores_) {
      const updatedChunks = store.updateAndCollectChunkChanges();

      for (const chunk of updatedChunks) {
        if (chunk.priority === null) {
          this.queue_.cancel(chunk);
          this.disposeChunkTexture(chunk);
        } else if (chunk.state === "queued") {
          this.queue_.enqueue(chunk, (signal) =>
            store.loadChunkData(chunk, signal)
          );
        }
      }

      this.uploadLoadedChunks(store, updatedChunks);
    }

    this.queue_.flush();

    for (const [source, store] of this.stores_) {
      if (store.canDispose()) {
        this.stores_.delete(source);
      }
    }
  }

  // Uploads loaded-but-not-yet-resident chunks for GPU-rendering stores, then
  // releases the CPU copy when no CPU-rendering view still needs it.
  //
  // Uploads are synchronous GL calls on the main thread, so a burst (many
  // chunks finishing in one frame during fast playback) can block the thread
  // that also finalizes decodes, starving the load pipeline. Cap how many we
  // upload per tick; the rest go next tick. Highest priority first, so a cap
  // never starves on-screen chunks in favor of look-ahead.
  private uploadLoadedChunks(store: ChunkStore, chunks: Set<Chunk>) {
    if (!this.uploadTexture_ || !store.hasGpuRenderingView()) return;

    const pending: Chunk[] = [];
    for (const chunk of chunks) {
      if (chunk.state === "loaded" && chunk.texture === undefined) {
        pending.push(chunk);
      }
    }
    if (pending.length === 0) return;
    pending.sort(compareByPriority);

    const limit = Math.min(pending.length, this.maxUploadsPerUpdate);
    for (let i = 0; i < limit; i++) {
      const chunk = pending[i];
      const texture = Texture3D.createWithChunk(chunk);
      // The manager owns this texture's GPU lifecycle (disposeChunkTexture), so
      // renderables that bind it must not dispose it when they swap slots.
      texture.managedExternally = true;
      this.uploadTexture_(texture);
      chunk.texture = texture;
      // The texture is self-sufficient on the GPU now, so drop its CPU alias.
      // The chunk's own CPU copy is kept or released by the store, based on
      // whether a CPU consumer (2D slicing/picking) still demands it.
      texture.releaseCpuData();
    }
  }

  // Frees a chunk's GPU texture once it leaves the working set, mirroring the
  // CPU disposal the store performs. Clears the residency signal so a revisit
  // re-uploads from a fresh fetch.
  private disposeChunkTexture(chunk: Chunk) {
    if (!this.disposeTexture_ || chunk.texture === undefined) return;
    this.disposeTexture_(chunk.texture);
    chunk.texture = undefined;
  }
}
