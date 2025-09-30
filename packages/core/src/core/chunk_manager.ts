import {
  Chunk,
  SourceDimensionMap,
  ChunkLoader,
  ChunkSource,
  SliceCoordinates,
} from "../data/chunk";
import { ReadonlyVec2, vec2, vec3 } from "gl-matrix";
import { Box2 } from "../math/box2";
import { Box3 } from "../math/box3";
import { almostEqual } from "../utilities/almost_equal";
import { Logger } from "../utilities/logger";
import { OrthographicCamera } from "../objects/cameras/orthographic_camera";
import { ChunkQueue } from "../data/chunk_queue";

// Number of chunks to extend beyond the visible bounds in each direction (x/y/z)
// These additional chunks are prefetched to improve responsiveness when panning.
const PREFETCH_PADDING_CHUNKS = 0;

// Fetch some number of time points ahead of current time.
const PREFETCH_TIME_POINTS = 10;

// Visible chunks at the fallback LOD.
const PRI_FALLBACK_VISIBLE = 0;
// Prioritized prefetch chunks not at the current time (e.g. during playback).
const PRI_PREFETCH_TIME_HIGH = 1;
// Visible chunks at the current LOD.
const PRI_VISIBLE_CURRENT = 2;
// Non-prioritized prefetch chunks not at the current time.
const PRI_PREFETCH_TIME_LOW = 3;
// Non-visible chunks at the fallback LOD.
const PRI_FALLBACK_BACKGROUND = 4;
// Prefetch non-visible chunks at the current time.
const PRI_PREFETCH_SPACE = 5;

export class ChunkManagerSource {
  // First dimension of the array is time, the others cover LOD, x, y, z, c.
  private readonly chunks_: Chunk[][];
  private readonly loader_;
  private readonly lowestResLOD_: number;
  private readonly sliceCoords_: SliceCoordinates;
  private readonly dimensions_: SourceDimensionMap;
  private currentLOD_: number = 0;
  // TODO: make LOD bias configurable per-source or per-layer
  // positive values nudge towards coarser resolution (higher LOD number)
  private lodBias_: number = 0.5;
  private lastViewBounds2D_: Box2 | null = null;
  private lastZBounds_?: [number, number];
  private lastTCoord_?: number;

  public prioritizePrefetchTime: boolean = false;
  private tCoordsWithQueuedChunks_: Set<number> = new Set();

  constructor(loader: ChunkLoader, sliceCoords: SliceCoordinates) {
    this.loader_ = loader;
    this.dimensions_ = this.loader_.getSourceDimensionMap();
    this.lowestResLOD_ = this.dimensions_.numLods - 1;
    this.currentLOD_ = 0;
    this.sliceCoords_ = sliceCoords;

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

        for (let x = 0; x < chunksX; ++x) {
          const xOffset = xLod.translation + x * xLod.chunkSize * xLod.scale;
          for (let y = 0; y < chunksY; ++y) {
            const yOffset = yLod.translation + y * yLod.chunkSize * yLod.scale;
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
                  x: chunkWidth,
                  y: chunkHeight,
                  z: chunkDepth,
                  c: channels,
                },
                rowStride: chunkWidth,
                rowAlignmentBytes: 1,
                chunkIndex: { x, y, z, t },
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

  public getChunks(): Chunk[] {
    const currentTimeChunks = this.getChunksAtCurrentTime();
    const currentLODChunks = currentTimeChunks.filter(
      (chunk) =>
        chunk.lod === this.currentLOD_ &&
        chunk.visible &&
        chunk.state === "loaded"
    );

    // If we're at the lowest resolution LOD, only return current LOD chunks
    if (this.currentLOD_ === this.lowestResLOD_) {
      return currentLODChunks;
    }

    const lowResChunks = currentTimeChunks.filter(
      (chunk) =>
        chunk.lod === this.lowestResLOD_ &&
        chunk.visible &&
        chunk.state === "loaded"
    );

    return [...lowResChunks, ...currentLODChunks];
  }

  public getChunksAtCurrentTime(): Chunk[] {
    return this.chunks_[this.sliceCoords_.t ?? 0];
  }

  public allVisibleLowestLODLoaded(): boolean {
    return this.getChunksAtCurrentTime()
      .filter((c) => c.visible && c.lod === this.lowestResLOD_)
      .every((c) => c.state === "loaded");
  }

  public updateAndCollectChunkChanges(lodFactor: number, viewBounds2D: Box2) {
    this.setLOD(lodFactor);
    const zBounds = this.getZBounds();
    let updatedChunks: Chunk[] = [];

    if (
      this.viewBounds2DChanged(viewBounds2D) ||
      this.zBoundsChanged(zBounds) ||
      this.lastTCoord_ !== this.sliceCoords_.t
    ) {
      updatedChunks =
        this.updateAndCollectChunkChangesForCurrentLod(viewBounds2D);
    }

    this.lastViewBounds2D_ = viewBounds2D.clone();
    this.lastZBounds_ = zBounds;
    this.lastTCoord_ = this.sliceCoords_.t;
    return updatedChunks;
  }

  public get lodCount() {
    return this.lowestResLOD_ + 1;
  }

  public get dimensions() {
    return this.dimensions_;
  }

  public get currentLOD(): number {
    return this.currentLOD_;
  }

  public loadChunkData(chunk: Chunk, signal: AbortSignal) {
    return this.loader_.loadChunkData(chunk, this.sliceCoords_, signal);
  }

  private setLOD(lodFactor: number): void {
    // `scale` here is the x-width of an image pixel in virtual units at LOD 0.
    // So (ignoring the bias term) subtracting `lodFactor` from `Math.log2(scale)`
    // is effectively `Math.log2(virtualUnitsPerScreenPixel / xScale)`.
    // That is, `adjustedLodFactor = Math.log2(imagePixelsPerScreenPixel)`;
    // or in other words, how many image pixels (LOD 0) fit in a screen pixel.
    // Use of log2 here and in ChunkManager relies on the assumption that
    // each LOD is downsampled by a factor of 2 in X and Y.
    const sourceAdjustment =
      this.lodBias_ - Math.log2(this.dimensions_.x.lods[0].scale);
    const sourceAdjustedLodFactor = sourceAdjustment - lodFactor;
    const maxLOD = this.lowestResLOD_;
    const targetLOD = Math.max(
      0,
      Math.min(maxLOD, Math.floor(sourceAdjustedLodFactor))
    );

    if (targetLOD !== this.currentLOD_) {
      Logger.debug(
        "ChunkManagerSource",
        `LOD changed from ${this.currentLOD_} to ${targetLOD}`
      );
      this.currentLOD_ = targetLOD;
    }
  }

  private updateAndCollectChunkChangesForCurrentLod(
    viewBounds2D: Box2
  ): Chunk[] {
    if (this.chunks_.length === 0) {
      Logger.warn(
        "ChunkManagerSource",
        "updateChunkVisibility called with no chunks initialized"
      );
      return [];
    }

    const [zMin, zMax] = this.getZBounds();
    const viewBounds3D = new Box3(
      vec3.fromValues(viewBounds2D.min[0], viewBounds2D.min[1], zMin),
      vec3.fromValues(viewBounds2D.max[0], viewBounds2D.max[1], zMax)
    );

    const paddedBounds = this.getPaddedBounds(viewBounds3D);
    const center = vec2.create();
    vec2.lerp(center, viewBounds2D.min, viewBounds2D.max, 0.5);

    const updatedChunks: Chunk[] = [];
    updatedChunks.push(...this.disposeStaleTimeChunks());

    const currentTimeChunks = this.chunks_[this.sliceCoords_.t ?? 0];
    this.tCoordsWithQueuedChunks_.add(this.sliceCoords_.t ?? 0);
    for (const chunk of currentTimeChunks) {
      const isVisible = this.isChunkWithinBounds(chunk, viewBounds3D);
      const eligibleForPrefetch =
        !isVisible && this.isChunkWithinBounds(chunk, paddedBounds);

      const isCurrentLOD = chunk.lod === this.currentLOD_;
      const isFallbackLOD = chunk.lod === this.lowestResLOD_;
      const isLoaded = chunk.state === "loaded";

      chunk.visible = isVisible;
      chunk.prefetch = eligibleForPrefetch && isCurrentLOD && !isLoaded;
      chunk.priority = this.computePriority(
        isFallbackLOD,
        isCurrentLOD,
        isVisible,
        chunk.prefetch
      );

      if (chunk.priority !== null && chunk.state === "unloaded") {
        chunk.state = "queued";
      } else if (chunk.priority === null && chunk.state === "queued") {
        chunk.state = "unloaded";
        chunk.orderKey = null;
      }

      if (chunk.priority !== null) {
        chunk.orderKey = this.orderKeyByDistance(chunk, center);
      }

      if (isLoaded && !isFallbackLOD) {
        const shouldDispose =
          !isCurrentLOD || (isCurrentLOD && !isVisible && !eligibleForPrefetch);
        if (shouldDispose) {
          this.disposeChunk(chunk);
        }
      }
    }
    updatedChunks.push(...currentTimeChunks);

    updatedChunks.push(...this.prefetchTimeChunks(viewBounds3D));

    return updatedChunks;
  }

  private prefetchTimeChunks(viewBounds3D: Box3): Chunk[] {
    if (this.sliceCoords_.t === undefined) return [];
    const tEnd = Math.min(
      this.chunks_.length,
      this.sliceCoords_.t + PREFETCH_TIME_POINTS + 1
    );
    const updatedChunks: Chunk[] = [];
    for (let t = this.sliceCoords_.t + 1; t < tEnd; ++t) {
      for (const chunk of this.chunks_[t]) {
        if (chunk.state !== "unloaded") continue;
        const isLowestLOD = chunk.lod === this.lowestResLOD_;
        const isVisible = this.isChunkWithinBounds(chunk, viewBounds3D);
        if (isLowestLOD && isVisible) {
          chunk.prefetch = true;
          chunk.priority = this.prioritizePrefetchTime
            ? PRI_PREFETCH_TIME_HIGH
            : PRI_PREFETCH_TIME_LOW;
          chunk.orderKey = t - this.sliceCoords_.t;
          chunk.state = "queued";
          this.tCoordsWithQueuedChunks_.add(t);
          updatedChunks.push(chunk);
        }
      }
    }
    return updatedChunks;
  }

  private disposeStaleTimeChunks(): Chunk[] {
    if (this.sliceCoords_.t === undefined) return [];
    const disposedChunks: Chunk[] = [];
    for (const t of this.tCoordsWithQueuedChunks_) {
      const delta = t - this.sliceCoords_.t;
      if (delta >= 0 && delta <= PREFETCH_TIME_POINTS) continue;
      const chunks = this.chunks_[t];
      for (const chunk of chunks) {
        chunk.visible = false;
        this.disposeChunk(chunk);
        disposedChunks.push(chunk);
      }
      this.tCoordsWithQueuedChunks_.delete(t);
    }
    return disposedChunks;
  }

  private disposeChunk(chunk: Chunk) {
    chunk.data = undefined;
    chunk.state = "unloaded";
    chunk.priority = null;
    chunk.orderKey = null;
    chunk.prefetch = false;
    Logger.debug(
      "ChunkManagerSource",
      `Disposing chunk ${JSON.stringify(chunk.chunkIndex)} in LOD ${chunk.lod}`
    );
  }

  private computePriority(
    isFallbackLOD: boolean,
    isCurrentLOD: boolean,
    isVisible: boolean,
    isPrefetch: boolean
  ) {
    if (isFallbackLOD && isVisible) return PRI_FALLBACK_VISIBLE;
    if (isCurrentLOD && isVisible) return PRI_VISIBLE_CURRENT;
    if (isFallbackLOD) return PRI_FALLBACK_BACKGROUND;
    if (isCurrentLOD && isPrefetch) return PRI_PREFETCH_SPACE;
    return null;
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
          `ChunkManager only supports a chunk size of 1 in t. Found ${tLod.chunkSize} at LOD ${lod}`
        );
      }
      if (tLod.scale !== 1) {
        throw new Error(
          `ChunkManager does not support scale in t. Found ${tLod.scale} at LOD ${lod}`
        );
      }
      if (tLod.translation !== 0) {
        throw new Error(
          `ChunkManager does not support translation in t. Found ${tLod.translation} at LOD ${lod}`
        );
      }
      const prevTLod = this.dimensions_.t?.lods[lod - 1];
      if (!prevTLod) continue;
      if (tLod.size !== prevTLod.size) {
        throw new Error(
          `ChunkManager does not support downsampling in t. Found ${prevTLod.size} at LOD ${lod - 1} → ${tLod.size} at LOD ${lod}`
        );
      }
    }
    return {
      size: this.dimensions_.t?.lods[0].size ?? 1,
    };
  }

  private isChunkWithinBounds(chunk: Chunk, bounds: Box3): boolean {
    const chunkBounds = new Box3(
      vec3.fromValues(chunk.offset.x, chunk.offset.y, chunk.offset.z),
      vec3.fromValues(
        chunk.offset.x + chunk.shape.x * chunk.scale.x,
        chunk.offset.y + chunk.shape.y * chunk.scale.y,
        chunk.offset.z + chunk.shape.z * chunk.scale.z
      )
    );
    return Box3.intersects(chunkBounds, bounds);
  }

  private getZBounds(): [number, number] {
    const zDim = this.dimensions_.z;
    if (zDim === undefined || this.sliceCoords_.z === undefined) return [0, 1];

    const zLod = zDim.lods[this.currentLOD_];
    const zShape = zLod.size;
    const zScale = zLod.scale;
    const zTran = zLod.translation;
    const zPoint = Math.floor((this.sliceCoords_.z - zTran) / zScale);
    const chunkDepth = zLod.chunkSize;

    const zChunk = Math.max(
      0,
      Math.min(
        Math.floor(zPoint / chunkDepth),
        Math.ceil(zShape / chunkDepth) - 1
      )
    );

    return [
      zTran + zChunk * chunkDepth * zScale,
      zTran + (zChunk + 1) * chunkDepth * zScale,
    ];
  }

  private viewBounds2DChanged(newBounds: Box2): boolean {
    return (
      this.lastViewBounds2D_ === null ||
      !vec2.equals(this.lastViewBounds2D_.min, newBounds.min) ||
      !vec2.equals(this.lastViewBounds2D_.max, newBounds.max)
    );
  }

  private zBoundsChanged(newBounds: [number, number]): boolean {
    return !this.lastZBounds_ || !vec2.equals(this.lastZBounds_, newBounds);
  }

  private getPaddedBounds(bounds: Box3): Box3 {
    const xLod = this.dimensions_.x.lods[this.currentLOD_];
    const yLod = this.dimensions_.y.lods[this.currentLOD_];

    const padX = xLod.chunkSize * xLod.scale * PREFETCH_PADDING_CHUNKS;
    const padY = yLod.chunkSize * yLod.scale * PREFETCH_PADDING_CHUNKS;

    // Disable prefetching in Z until chunk prioritization exists.
    const padZ = 0;

    return new Box3(
      vec3.fromValues(
        bounds.min[0] - padX,
        bounds.min[1] - padY,
        bounds.min[2] - padZ
      ),
      vec3.fromValues(
        bounds.max[0] + padX,
        bounds.max[1] + padY,
        bounds.max[2] + padZ
      )
    );
  }

  private orderKeyByDistance(chunk: Chunk, center: ReadonlyVec2): number {
    const chunkCenter = {
      x: chunk.offset.x + 0.5 * chunk.shape.x * chunk.scale.x,
      y: chunk.offset.y + 0.5 * chunk.shape.y * chunk.scale.y,
    };
    const dx = chunkCenter.x - center[0];
    const dy = chunkCenter.y - center[1];
    return dx * dx + dy * dy;
  }
}

export class ChunkManager {
  private readonly sources_ = new Map<ChunkSource, ChunkManagerSource>();
  private readonly queue_ = new ChunkQueue();

  public async addSource(source: ChunkSource, sliceCoords: SliceCoordinates) {
    let existing = this.sources_.get(source);
    if (!existing) {
      const loader = await source.open();
      existing = new ChunkManagerSource(loader, sliceCoords);
      this.sources_.set(source, existing);
    }
    return existing;
  }

  public update(camera: OrthographicCamera, bufferWidth: number) {
    if (this.sources_.size === 0) return;

    if (camera.type !== "OrthographicCamera") {
      throw new Error(
        "ChunkManager currently supports only orthographic cameras. " +
          "Update the implementation before using a perspective camera."
      );
    }

    const viewBounds2D = camera.getWorldViewRect();
    const virtualWidth = Math.abs(viewBounds2D.max[0] - viewBounds2D.min[0]);
    const virtualUnitsPerScreenPixel = virtualWidth / bufferWidth;
    const lodFactor = Math.log2(1 / virtualUnitsPerScreenPixel);

    for (const [_, source] of this.sources_) {
      const updatedChunks = source.updateAndCollectChunkChanges(
        lodFactor,
        viewBounds2D
      );
      for (const chunk of updatedChunks) {
        if (chunk.priority === null) {
          this.queue_.cancel(chunk);
        } else if (chunk.state === "queued") {
          this.queue_.enqueue(chunk, (signal) =>
            source.loadChunkData(chunk, signal)
          );
        }
      }
    }

    this.queue_.flush();
  }
}
