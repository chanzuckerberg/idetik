import { CachedChunkLoader } from "../data/cached_chunk_loader";
import { ChunkSource } from "../data/chunk";

export class SourceManager {
  private sourceMap_: Map<ChunkSource, CachedChunkLoader | null> = new Map();

  public async getLoader(source: ChunkSource) {
    const cachedLoader = this.sourceMap_.get(source);
    if (cachedLoader === undefined) {
      this.sourceMap_.set(source, null);
      const loader = await source.open();
      const cachedLoader = new CachedChunkLoader(loader);
      this.sourceMap_.set(source, cachedLoader);
      return cachedLoader;
    }
    return cachedLoader;
  }
}
