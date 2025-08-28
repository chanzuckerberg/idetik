import { CachedChunkLoader } from "../data/cached_chunk_loader";
import { ChunkSource } from "../data/chunk";

export class ChunkManager {
  // missing/undefined: source has not been opened before
  // null: source is being opened
  private sourceMap_: Map<ChunkSource, CachedChunkLoader | null> = new Map();

  public getLoader(source: ChunkSource) {
    return this.sourceMap_.get(source);
  }

  public async openLoader(source: ChunkSource) {
    this.sourceMap_.set(source, null);
    const loader = await source.open();
    const cachedLoader = new CachedChunkLoader(loader);
    this.sourceMap_.set(source, cachedLoader);
    return cachedLoader;
  }
}
