import {
  Chunk,
  SourceDimensionMap,
  ChunkLoader,
  SliceCoordinates,
  coordToIndex,
} from "../data/chunk";
import { Logger } from "../utilities/logger";
import { almostEqual } from "../utilities/almost_equal";
import { ChunkStoreView } from "./chunk_store_view";
import { Viewport } from "./viewport";

/**
 * ChunkStore manages chunk data for a single data source.
 * It owns the chunks in memory, handles loading, and provides access to metadata.
 * This is the heavy, shared resource that multiple viewports can reference.
 */
export class ChunkStore {
  // First dimension of the array is time, the others cover LOD, x, y, z, c.
  private readonly chunks_: Chunk[][];
  private readonly loader_: ChunkLoader;
  private readonly lowestResLOD_: number;
  private readonly dimensions_: SourceDimensionMap;
  private readonly views_: Set<ChunkStoreView> = new Set();

  constructor(loader: ChunkLoader) {
    this.loader_ = loader;
    this.dimensions_ = this.loader_.getSourceDimensionMap();
    this.lowestResLOD_ = this.dimensions_.numLods - 1;

    this.validateXYScaleRatios();
    const { size: chunksT } = this.getAndValidateTimeDimension();

    // generate chunks for each LOD without loading data
    this.chunks_ = Array.from({ length: chunksT }, () => []);
    for (let t = 0; t < chunksT; ++t) {
      const chunksAtT = this.chunks_[t];
      for (let lod = 0; lod < this.dimensions_.numLods; ++lod) {
        const xLod = this.dimensions_.x.lods[lod];
        const yLod = this.dimensions_.y.lods[lod];
        const zLod = this.dimensions_.z?.lods[lod];
        const cLod = this.dimensions_.c?.lods[lod];

        const chunkWidth = xLod.chunkSize;
        const chunkHeight = yLod.chunkSize;
        const chunkDepth = zLod?.chunkSize ?? 1;

        const chunksX = Math.ceil(xLod.size / chunkWidth);
        const chunksY = Math.ceil(yLod.size / chunkHeight);
        const chunksZ = Math.ceil((zLod?.size ?? 1) / chunkDepth);
        const channels = cLod?.size ?? 1;

        for (let c = 0; c < channels; ++c) {
          for (let x = 0; x < chunksX; ++x) {
            const xOffset = xLod.translation + x * xLod.chunkSize * xLod.scale;
            const rowStride = Math.min(chunkWidth, xLod.size - x * chunkWidth);
            for (let y = 0; y < chunksY; ++y) {
              const yOffset =
                yLod.translation + y * yLod.chunkSize * yLod.scale;
              for (let z = 0; z < chunksZ; ++z) {
                const zOffset =
                  zLod !== undefined
                    ? zLod.translation + z * chunkDepth * zLod.scale
                    : 0;
                chunksAtT.push({
                  state: "unloaded",
                  lod,
                  visible: false,
                  prefetch: false,
                  priority: null,
                  orderKey: null,
                  shape: {
                    x: Math.min(chunkWidth, xLod.size - x * chunkWidth),
                    y: Math.min(chunkHeight, yLod.size - y * chunkHeight),
                    z: Math.min(chunkDepth, (zLod?.size ?? 1) - z * chunkDepth),
                    c: 1, // Each chunk is single-channel
                  },
                  rowStride,
                  rowAlignmentBytes: 1,
                  chunkIndex: { x, y, z, c, t },
                  scale: {
                    x: xLod.scale,
                    y: yLod.scale,
                    z: zLod?.scale ?? 1,
                  },
                  offset: {
                    x: xOffset,
                    y: yOffset,
                    z: zOffset,
                  },
                });
              }
            }
          }
        }
      }
    }
  }

  public getChunksAtTime(timeIndex: number): Chunk[] {
    return this.chunks_[timeIndex];
  }

  public getTimeIndex(sliceCoords: SliceCoordinates): number {
    if (sliceCoords.t === undefined) return 0;
    if (this.dimensions_.t === undefined) return 0;
    return coordToIndex(this.dimensions_.t.lods[0], sliceCoords.t);
  }

  public allVisibleLowestLODLoaded(timeIndex: number): boolean {
    return this.getChunksAtTime(timeIndex)
      .filter((c) => c.visible && c.lod === this.lowestResLOD_)
      .every((c) => c.state === "loaded");
  }

  public get lodCount() {
    return this.lowestResLOD_ + 1;
  }

  public get dimensions() {
    return this.dimensions_;
  }

  public getLowestResLOD(): number {
    return this.lowestResLOD_;
  }

  public loadChunkData(
    chunk: Chunk,
    sliceCoords: SliceCoordinates,
    signal: AbortSignal
  ) {
    return this.loader_.loadChunkData(chunk, sliceCoords, signal);
  }

  public disposeChunk(chunk: Chunk) {
    chunk.data = undefined;
    chunk.state = "unloaded";
    chunk.priority = null;
    chunk.orderKey = null;
    chunk.prefetch = false;
    Logger.debug(
      "ChunkStore",
      `Disposing chunk ${JSON.stringify(chunk.chunkIndex)} in LOD ${chunk.lod}`
    );
  }

  /**
   * Create a ChunkStoreView for a specific viewport.
   * This factory method encapsulates the relationship between ChunkStore and ChunkStoreView.
   */
  public createView(viewport: Viewport): ChunkStoreView {
    const view = new ChunkStoreView(this, viewport);
    this.views_.add(view);
    return view;
  }

  /**
   * Remove a view from tracking when it's no longer needed.
   * This should be called when a viewport is destroyed or a layer is detached.
   */
  public removeView(view: ChunkStoreView): void {
    this.views_.delete(view);
  }

  /**
   * Get all active views of this chunk store.
   */
  public get views(): ReadonlySet<ChunkStoreView> {
    return this.views_;
  }

  /**
   * Collects updated chunks from all views and clears their update lists.
   * Returns chunks along with their associated sliceCoords from each view.
   * This is called by ChunkManager during its update cycle.
   * TODO: Aggregate conflicting updates when multiple views affect the same chunk
   * (take highest priority, mark visible if any view needs it).
   */
  public consumeUpdatedChunks(): Array<{
    chunk: Chunk;
    sliceCoords: SliceCoordinates;
  }> {
    const allUpdated: Array<{ chunk: Chunk; sliceCoords: SliceCoordinates }> =
      [];
    for (const view of this.views_) {
      const chunks = view.consumeUpdatedChunks();
      const sliceCoords = view.lastSliceCoords ?? {};
      for (const chunk of chunks) {
        allUpdated.push({ chunk, sliceCoords });
      }
    }
    return allUpdated;
  }

  private validateXYScaleRatios(): void {
    // Validates that each LOD level is downsampled by a factor of 2 in X and Y.
    // Z downsampling is not validated here because it may be inconsistent or
    // completely absent in some pyramids.
    const xDim = this.dimensions_.x;
    const yDim = this.dimensions_.y;
    for (let i = 1; i < this.dimensions_.numLods; i++) {
      const rx = xDim.lods[i].scale / xDim.lods[i - 1].scale;
      const ry = yDim.lods[i].scale / yDim.lods[i - 1].scale;

      if (!almostEqual(rx, 2, 0.02) || !almostEqual(ry, 2, 0.02)) {
        throw new Error(
          `Invalid downsampling factor between levels ${i - 1} → ${i}: ` +
            `expected (2× in X and Y), but got ` +
            `(${rx.toFixed(2)}×, ${ry.toFixed(2)}×) from scale ` +
            `[${xDim.lods[i - 1].scale}, ${yDim.lods[i - 1].scale}] → [${xDim.lods[i].scale}, ${yDim.lods[i].scale}]`
        );
      }
    }
  }

  private getAndValidateTimeDimension() {
    for (let lod = 0; lod < this.dimensions_.numLods; ++lod) {
      const tLod = this.dimensions_.t?.lods[lod];
      if (!tLod) continue;
      if (tLod.chunkSize !== 1) {
        throw new Error(
          `ChunkStore only supports a chunk size of 1 in t. Found ${tLod.chunkSize} at LOD ${lod}`
        );
      }
      const prevTLod = this.dimensions_.t?.lods[lod - 1];
      if (!prevTLod) continue;
      if (tLod.size !== prevTLod.size) {
        throw new Error(
          `ChunkStore does not support downsampling in t. Found ${prevTLod.size} at LOD ${lod - 1} → ${tLod.size} at LOD ${lod}`
        );
      }
    }
    return {
      size: this.dimensions_.t?.lods[0].size ?? 1,
    };
  }
}
