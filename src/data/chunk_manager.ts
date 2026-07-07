import { Chunk, ChunkSource } from "./chunk";
import { ChunkQueue, comparePriority } from "./chunk_queue";
import { chunkMemoryStats, clearChunkData } from "./chunk_memory";
import { ChunkStore } from "./chunk_store";
import { ChunkStoreView } from "./chunk_store_view";
import { ImageSourcePolicy } from "../core/image_source_policy";
import { Texture, textureStorageBytes } from "../objects/textures/texture";
import { Texture3D } from "../objects/textures/texture_3d";

export type QueueStats = {
  pending: number;
  running: number;
};

const DEFAULT_MAX_CONCURRENT_REQUESTS = 8;
const DEFAULT_MAX_GPU_UPLOADS_PER_UPDATE = 4;

export class ChunkManager {
  private readonly stores_: { source: ChunkSource; store: ChunkStore }[] = [];
  private readonly queue_: ChunkQueue;

  private readonly uploadTexture_?: (texture: Texture) => void;
  private readonly disposeTexture_?: (texture: Texture) => void;
  private readonly getGpuResidentBytes_: () => number;
  private readonly memoryLimitBytes_: number;
  private readonly maxGpuUploadsPerUpdate_: number;

  private readonly resident_ = new Set<Chunk>();

  constructor(
    uploadTexture?: (texture: Texture) => void,
    disposeTexture?: (texture: Texture) => void,
    getGpuResidentBytes: () => number = () => 0,
    memoryLimitBytes: number = Infinity,
    maxConcurrentRequests: number = DEFAULT_MAX_CONCURRENT_REQUESTS,
    maxGpuUploadsPerUpdate: number = DEFAULT_MAX_GPU_UPLOADS_PER_UPDATE
  ) {
    this.uploadTexture_ = uploadTexture;
    this.disposeTexture_ = disposeTexture;
    this.getGpuResidentBytes_ = getGpuResidentBytes;
    this.memoryLimitBytes_ = memoryLimitBytes;
    this.maxGpuUploadsPerUpdate_ = Math.max(1, maxGpuUploadsPerUpdate);
    this.queue_ = new ChunkQueue(maxConcurrentRequests);
  }

  public get memoryLimitBytes(): number {
    return this.memoryLimitBytes_;
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
    const candidates: { source: ChunkSource; chunk: Chunk }[] = [];

    for (const { source, store } of this.stores_) {
      const updatedChunks = store.updateAndCollectChunkChanges();

      for (const chunk of updatedChunks) {
        if (chunk.priority === null) {
          this.releaseChunk(chunk);
        } else {
          chunk.releasedAt = undefined;
          if (chunk.state === "queued") {
            candidates.push({ source, chunk });
          }
        }
      }

      this.uploadLoadedChunks(updatedChunks);
    }

    this.enqueueWithinBudget(candidates);
    this.queue_.flush();

    for (let i = this.stores_.length - 1; i >= 0; i--) {
      if (this.stores_[i].store.canDispose()) {
        this.stores_.splice(i, 1);
      }
    }
  }

  private releaseChunk(chunk: Chunk) {
    this.queue_.cancel(chunk);

    if (chunk.texture !== undefined) {
      chunk.releasedAt ??= performance.now();
      return;
    }

    clearChunkData(chunk);
    if (chunk.state === "loaded") chunk.state = "unloaded";
  }

  private enqueueWithinBudget(
    candidates: { source: ChunkSource; chunk: Chunk }[]
  ) {
    if (candidates.length === 0) return;

    candidates.sort((a, b) => comparePriority(a.chunk, b.chunk));

    let committedBytes = this.getGpuResidentBytes_();
    let victims: Chunk[] | null = null;

    for (const { source, chunk } of candidates) {
      const bytes = this.chunkBytes(source, chunk);

      // A chunk that can never fit must not trigger eviction. It would drain
      // the entire cache and still be skipped.
      if (bytes > this.memoryLimitBytes_) continue;

      if (committedBytes + bytes > this.memoryLimitBytes_) {
        victims ??= this.evictionCandidates();
        committedBytes = this.evictWorseChunks(
          committedBytes,
          bytes,
          chunk,
          victims
        );
      }

      if (committedBytes + bytes > this.memoryLimitBytes_) continue;

      committedBytes += bytes;
      this.queue_.enqueue(chunk, (signal) =>
        source.loader.loadChunkData(chunk, signal)
      );
    }
  }

  private evictionCandidates(): Chunk[] {
    const victims: Chunk[] = [];

    for (const chunk of this.resident_) {
      if (chunk.visible) continue;
      victims.push(chunk);
    }

    return victims.sort((a, b) => {
      const byRankDescending = -comparePriority(a, b);
      if (byRankDescending !== 0) return byRankDescending;
      return (a.releasedAt ?? 0) - (b.releasedAt ?? 0);
    });
  }

  private evictWorseChunks(
    committedBytes: number,
    pendingBytes: number,
    candidate: Chunk,
    victims: Chunk[]
  ): number {
    while (
      committedBytes + pendingBytes > this.memoryLimitBytes_ &&
      victims.length > 0 &&
      comparePriority(victims[0], candidate) > 0
    ) {
      const victim = victims.shift()!;
      if (victim.texture === undefined) continue;

      committedBytes -= textureStorageBytes(victim.texture);
      this.disposeChunkTexture(victim);
      victim.state = "unloaded";
      victim.releasedAt = undefined;
    }

    return committedBytes;
  }

  private chunkBytes(source: ChunkSource, chunk: Chunk): number {
    const bytesPerElement = source.loader.getBytesPerElement();
    return chunk.shape.x * chunk.shape.y * chunk.shape.z * bytesPerElement;
  }

  private uploadLoadedChunks(chunks: Set<Chunk>) {
    if (!this.uploadTexture_) return;

    const pending: Chunk[] = [];

    for (const chunk of chunks) {
      if (chunk.state === "loaded" && chunk.texture === undefined) {
        pending.push(chunk);
      }
    }

    if (pending.length === 0) return;

    pending.sort(comparePriority);

    const limit = Math.min(pending.length, this.maxGpuUploadsPerUpdate_);

    for (let i = 0; i < limit; i++) {
      const chunk = pending[i];
      const texture = Texture3D.createWithChunk(chunk);
      this.uploadTexture_(texture);
      chunk.texture = texture;
      this.resident_.add(chunk);
      clearChunkData(chunk);
    }
  }

  private disposeChunkTexture(chunk: Chunk) {
    if (!this.disposeTexture_) return;

    if (chunk.texture === undefined) return;
    this.disposeTexture_(chunk.texture);
    chunk.texture = undefined;
    this.resident_.delete(chunk);
  }
}
