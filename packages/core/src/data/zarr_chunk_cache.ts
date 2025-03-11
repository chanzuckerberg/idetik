import * as zarr from "zarrita";
import { GetOptions, Slice } from "@zarrita/indexing";

type ChunkData = {
  data: Uint8Array | Uint16Array | Float32Array;
  shape: readonly number[];
  stride: readonly number[];
  [key: string]: unknown;
};
type ChunkOptions = Parameters<zarr.FetchStore["get"]>[1];

// A wrapper for zarr.Array that caches chunks to avoid redundant fetches and decompression
export class CachedZarrArray {
  private array_: zarr.Array<zarr.DataType, zarr.FetchStore>;
  private chunkCache_: Map<string, Promise<ChunkData>> = new Map();

  constructor(array: zarr.Array<zarr.DataType, zarr.FetchStore>) {
    this.array_ = array;
    console.debug(`Created CachedZarrArray for path ${array.path}`);
  }

  // Get access to the underlying array
  get underlyingArray(): zarr.Array<zarr.DataType, zarr.FetchStore> {
    return this.array_;
  }

  // Forward properties from the underlying array
  get shape(): readonly number[] {
    return this.array_.shape;
  }

  get dtype(): zarr.DataType {
    return this.array_.dtype;
  }

  get path(): string {
    return this.array_.path;
  }

  // Create a cache key from chunk indices
  private createChunkKey(chunkIndices: number[]): string {
    // Use a simple string key based on indices, but add a prefix to avoid
    // potential collisions with other string values
    return `chunk:${chunkIndices.join(",")}`;
  }

  // Cached version of getChunk
  public async getChunk(
    chunkIndices: number[],
    options: ChunkOptions = {}
  ): Promise<ChunkData> {
    const key = this.createChunkKey(chunkIndices);

    if (!this.chunkCache_.has(key)) {
      // Cache miss - fetch the chunk and store the promise
      console.debug(`Cache miss for chunk ${chunkIndices.join(",")}`);

      try {
        // Create promise for fetching the chunk
        const chunkPromise = this.array_.getChunk(
          chunkIndices,
          options
        ) as Promise<ChunkData>;

        // Store in cache before awaiting
        this.chunkCache_.set(key, chunkPromise);

        // Wait for the chunk
        await chunkPromise;

        console.debug(`Successfully loaded chunk ${chunkIndices.join(",")}`);
      } catch (error) {
        // If fetching fails, remove from cache so we can retry later
        this.chunkCache_.delete(key);
        throw error;
      }
    } else {
      console.debug(`Cache hit for chunk ${chunkIndices.join(",")}`);
    }

    // Return the cached promise (either existing or just created)
    return this.chunkCache_.get(key) as Promise<ChunkData>;
  }

  // Drop-in replacement for zarr.get - public method
  public async get(
    selection: Array<Slice | number>,
    options?: GetOptions<ChunkOptions>
  ): Promise<ChunkData> {
    // Create a proper proxy of the original array
    // Capture the getChunk method bound to this instance
    const getChunkMethod = this.getChunk.bind(this);

    const arrayWithCaching = new Proxy(this.array_, {
      get(target, prop) {
        if (prop === "getChunk") {
          // Return our cached version of getChunk
          return (chunkIndices: number[], chunkOptions?: ChunkOptions) => {
            return getChunkMethod(chunkIndices, {
              ...options,
              ...chunkOptions,
            });
          };
        }
        // Return the original property
        return Reflect.get(target, prop);
      },
    });

    // Use zarrita's get with our cache-enabled array
    return zarr.get(arrayWithCaching, selection, options) as Promise<ChunkData>;
  }

  // Clear the cache
  public clearCache(): void {
    this.chunkCache_.clear();
  }
}
