import {
  Chunk,
  SourceDimensionMap,
  ChunkLoader,
  coordToIndex,
} from "../data/chunk";
import { SliceCoordinates } from "../data/slice_coordinates";
import { almostEqual } from "../utilities/almost_equal";
import { Logger } from "../utilities/logger";
import { ChunkStoreView } from "./chunk_store_view";
import { ImageSourcePolicy } from "./image_source_policy";

export class ChunkStore {
  private readonly chunks_: Chunk[][];
  private readonly loader_: ChunkLoader;
  private readonly lowestResLOD_: number;
  private readonly dimensions_: SourceDimensionMap;
  private readonly views_: ChunkStoreView[] = [];
  private hasHadViews_ = false;

  constructor(loader: ChunkLoader) {
    this.loader_ = loader;
    this.dimensions_ = this.loader_.getSourceDimensionMap();
    this.lowestResLOD_ = this.dimensions_.numLods - 1;

    this.validateXYScaleRatios();
    const { size: chunksT } = this.getAndValidateTimeDimension();
    const { size: chunksC } = this.getAndValidateChannelDimension();

    this.chunks_ = Array.from({ length: chunksT }, () => []);
    for (let t = 0; t < chunksT; ++t) {
      const chunksAtT = this.chunks_[t];
      for (let lod = 0; lod < this.dimensions_.numLods; ++lod) {
        const xLod = this.dimensions_.x.lods[lod];
        const yLod = this.dimensions_.y.lods[lod];
        const zLod = this.dimensions_.z?.lods[lod];

        const chunkWidth = xLod.chunkSize;
        const chunkHeight = yLod.chunkSize;
        const chunkDepth = zLod?.chunkSize ?? 1;

        const chunksX = Math.ceil(xLod.size / chunkWidth);
        const chunksY = Math.ceil(yLod.size / chunkHeight);
        const chunksZ = Math.ceil((zLod?.size ?? 1) / chunkDepth);

        for (let c = 0; c < chunksC; ++c) {
          for (let x = 0; x < chunksX; ++x) {
            const xOffset = xLod.translation + x * xLod.chunkSize * xLod.scale;
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
                    c: 1,
                  },
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

  public get lodCount() {
    return this.lowestResLOD_ + 1;
  }

  public get dimensions() {
    return this.dimensions_;
  }

  public getLowestResLOD(): number {
    return this.lowestResLOD_;
  }

  public loadChunkData(chunk: Chunk, signal: AbortSignal) {
    return this.loader_.loadChunkData(chunk, signal);
  }

  public createView(policy: ImageSourcePolicy): ChunkStoreView {
    const view = new ChunkStoreView(this, policy);
    this.views_.push(view);
    this.hasHadViews_ = true;
    return view;
  }

  public removeView(view: ChunkStoreView): void {
    const index = this.views_.indexOf(view);
    if (index === -1) {
      throw new Error(
        "Cannot remove view: view not found in store's view list"
      );
    }

    const affectedChunks = Array.from(view.chunkViewStates.keys());
    this.views_.splice(index, 1);

    for (const chunk of affectedChunks) {
      this.aggregateChunkViewStates(chunk);
    }
  }

  public get views(): ReadonlyArray<ChunkStoreView> {
    return this.views_;
  }

  public canDispose(): boolean {
    return this.hasHadViews_ && this.views_.length === 0;
  }

  public updateAndCollectChunkChanges(): Set<Chunk> {
    const affectedChunks = new Set<Chunk>();
    for (const view of this.views_) {
      for (const [chunk, _viewState] of view.chunkViewStates) {
        affectedChunks.add(chunk);
      }
    }

    for (const chunk of affectedChunks) {
      this.aggregateChunkViewStates(chunk);
    }

    return affectedChunks;
  }

  private aggregateChunkViewStates(chunk: Chunk): void {
    let anyVisible = false;
    let anyPrefetch = false;
    let minPriority: number | null = null;
    let orderKeyForMinPriority: number | null = null;

    for (const view of this.views_) {
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

    const shouldEnqueueChunk =
      chunk.priority !== null && chunk.state === "unloaded";
    if (shouldEnqueueChunk) {
      chunk.state = "queued";
      return;
    }

    const shouldCancelQueuedChunk =
      chunk.priority === null && chunk.state === "queued";
    if (shouldCancelQueuedChunk) {
      chunk.state = "unloaded";
      return;
    }

    const shouldDisposeChunk =
      chunk.state === "loaded" && chunk.priority === null;
    if (shouldDisposeChunk) {
      if (chunk.visible || chunk.prefetch) {
        throw new Error(
          `Chunk state inconsistency detected: priority is null but visible=${chunk.visible} or prefetch=${chunk.prefetch} ` +
            `for chunk ${JSON.stringify(chunk.chunkIndex)} in LOD ${chunk.lod}`
        );
      }

      chunk.data = undefined;
      chunk.state = "unloaded";
      chunk.orderKey = null;
      Logger.debug(
        "ChunkStore",
        `Disposing chunk ${JSON.stringify(chunk.chunkIndex)} in LOD ${chunk.lod}`
      );
    }
  }

  private validateXYScaleRatios(): void {
    // Validates that each LOD level is downsampled by a factor of 2 in X and Y.
    // Z downsampling is not validated here because it's not guaranteed.
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

  private getAndValidateChannelDimension() {
    for (let lod = 0; lod < this.dimensions_.numLods; ++lod) {
      const cLod = this.dimensions_.c?.lods[lod];
      if (!cLod) continue;
      if (cLod.chunkSize !== 1) {
        throw new Error(
          `ChunkStore only supports a chunk size of 1 in c. Found ${cLod.chunkSize} at LOD ${lod}`
        );
      }
      if (cLod.scale !== 1) {
        throw new Error(
          `ChunkStore does not support scale in c. Found ${cLod.scale} at LOD ${lod}`
        );
      }
      if (cLod.translation !== 0) {
        throw new Error(
          `ChunkStore does not support translation in c. Found ${cLod.translation} at LOD ${lod}`
        );
      }
      const prevCLod = this.dimensions_.c?.lods[lod - 1];
      if (!prevCLod) continue;
      if (cLod.size !== prevCLod.size) {
        throw new Error(
          `ChunkStore does not support downsampling in c. Found ${prevCLod.size} at LOD ${lod - 1} → ${cLod.size} at LOD ${lod}`
        );
      }
    }
    return {
      size: this.dimensions_.c?.lods[0].size ?? 1,
    };
  }
}
