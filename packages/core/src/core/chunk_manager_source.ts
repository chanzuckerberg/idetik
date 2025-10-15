import {
  Chunk,
  SourceDimensionMap,
  ChunkLoader,
  SliceCoordinates,
  coordToIndex,
} from "../data/chunk";
import { ImageSourcePolicy } from "./image_source_policy";
import { ReadonlyVec2, vec2, vec3 } from "gl-matrix";
import { Box2 } from "../math/box2";
import { Box3 } from "../math/box3";
import { almostEqual } from "../utilities/almost_equal";
import { Logger } from "../utilities/logger";
import { clamp } from "../utilities/clamp";

export class ChunkManagerSource {
  private readonly chunks_: Chunk[][];
  private readonly loader_;
  private readonly lowestResLOD_: number;
  private readonly sliceCoords_: SliceCoordinates;
  private readonly dimensions_: SourceDimensionMap;
  private policy_: ImageSourcePolicy;
  private policyChanged_ = false;
  private currentLOD_: number = 0;
  private lastViewBounds2D_: Box2 | null = null;
  private lastZBounds_?: [number, number];
  private lastTCoord_?: number;

  private tIndicesWithQueuedChunks_: Set<number> = new Set();
  private sourceMaxSquareDistance2D_: number;

  constructor(
    loader: ChunkLoader,
    sliceCoords: SliceCoordinates,
    policy: ImageSourcePolicy
  ) {
    this.loader_ = loader;
    this.policy_ = policy;
    this.dimensions_ = this.loader_.getSourceDimensionMap();
    this.lowestResLOD_ = this.dimensions_.numLods - 1;
    this.currentLOD_ = 0;
    this.sliceCoords_ = sliceCoords;

    Logger.info(
      "ChunkManagerSource",
      "Using image source policy:",
      this.policy_.profile
    );

    this.validateXYScaleRatios();
    const { size: chunksT } = this.getAndValidateTimeDimension();
    const { size: chunksC } = this.getAndValidateChannelDimension();

    const xLod0 = this.dimensions_.x.lods[0];
    const yLod0 = this.dimensions_.y.lods[0];
    this.sourceMaxSquareDistance2D_ = vec2.squaredLength(
      vec2.fromValues(xLod0.size * xLod0.scale, yLod0.size * yLod0.scale)
    );

    // generate chunks for each LOD without loading data
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

        for (let x = 0; x < chunksX; ++x) {
          const xOffset = xLod.translation + x * xLod.chunkSize * xLod.scale;
          const rowStride = Math.min(chunkWidth, xLod.size - x * chunkWidth);
          for (let y = 0; y < chunksY; ++y) {
            const yOffset = yLod.translation + y * yLod.chunkSize * yLod.scale;
            for (let z = 0; z < chunksZ; ++z) {
              const zOffset =
                zLod !== undefined
                  ? zLod.translation + z * chunkDepth * zLod.scale
                  : 0;
              for (let c = 0; c < chunksC; ++c) {
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
    return this.chunks_[this.getCurrentTimeIndex()];
  }

  private getCurrentTimeIndex() {
    if (this.sliceCoords_.t === undefined) return 0;
    if (this.dimensions_.t === undefined) return 0;
    return coordToIndex(this.dimensions_.t.lods[0], this.sliceCoords_.t);
  }

  public allVisibleLowestLODLoaded(): boolean {
    return this.getChunksAtCurrentTime()
      .filter((c) => c.visible && c.lod === this.lowestResLOD_)
      .every((c) => c.state === "loaded");
  }

  public updateAndCollectChunkChanges(lodFactor: number, viewBounds2D: Box2) {
    this.setLOD(lodFactor);

    const zBounds = this.getZBounds();
    const changed =
      this.policyChanged_ ||
      this.viewBounds2DChanged(viewBounds2D) ||
      this.zBoundsChanged(zBounds) ||
      this.lastTCoord_ !== this.sliceCoords_.t;

    const updatedChunks = changed
      ? this.updateAndCollectChunkChangesForCurrentLod(viewBounds2D)
      : [];

    this.policyChanged_ = false;
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

  public get imageSourcePolicy(): Readonly<ImageSourcePolicy> {
    return this.policy_;
  }

  public set imageSourcePolicy(policy: ImageSourcePolicy) {
    if (this.policy_ !== policy) {
      this.policyChanged_ = true;
      this.policy_ = policy;

      Logger.info(
        "ChunkManagerSource",
        "Using image source policy:",
        this.policy_.profile
      );
    }
  }

  public loadChunkData(chunk: Chunk, signal: AbortSignal) {
    return this.loader_.loadChunkData(chunk, signal);
  }

  private setLOD(lodFactor: number): void {
    // `scale0` is the x pixel size (world units) at LOD 0.
    // With 2x downsampling per LOD, selection happens in log2 space.
    const scale0 = this.dimensions_.x.lods[0].scale;
    const bias = this.policy_.lod.bias;

    // How many LOD 0 pixels per screen pixel, normalized by source scale and bias.
    const sourceAdjusted = bias - Math.log2(scale0) - lodFactor;
    const desiredLOD = Math.floor(sourceAdjusted);

    // Intersect dataset bounds with policy bounds.
    const minPolicyLOD = Math.max(
      0,
      Math.min(this.lowestResLOD_, this.policy_.lod.min)
    );
    const maxPolicyLOD = Math.max(
      minPolicyLOD,
      Math.min(this.lowestResLOD_, this.policy_.lod.max)
    );

    const target = Math.max(minPolicyLOD, Math.min(maxPolicyLOD, desiredLOD));

    if (target !== this.currentLOD_) {
      Logger.debug(
        "ChunkManagerSource",
        `LOD changed from ${this.currentLOD_} to ${target}`
      );
      this.currentLOD_ = target;
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

    const viewBoundsCenter2D = vec2.create();
    vec2.lerp(viewBoundsCenter2D, viewBounds2D.min, viewBounds2D.max, 0.5);

    const [zMin, zMax] = this.getZBounds();
    const viewBounds3D = new Box3(
      vec3.fromValues(viewBounds2D.min[0], viewBounds2D.min[1], zMin),
      vec3.fromValues(viewBounds2D.max[0], viewBounds2D.max[1], zMax)
    );

    const modifiedChunks: Chunk[] = [];

    const currentTimeIndex = this.getCurrentTimeIndex();

    if (this.sliceCoords_.t !== undefined) {
      const disposedChunks = this.disposeStaleTimeChunks(currentTimeIndex);
      modifiedChunks.push(...disposedChunks);
    }

    const currentTimeChunks = this.updateChunksAtTimeIndex(
      currentTimeIndex,
      viewBounds3D,
      viewBoundsCenter2D
    );
    modifiedChunks.push(...currentTimeChunks);

    if (this.sliceCoords_.t !== undefined) {
      const prefetchedChunks = this.markTimeChunksForPrefetch(
        currentTimeIndex,
        viewBounds3D,
        viewBoundsCenter2D
      );
      modifiedChunks.push(...prefetchedChunks);
    }

    return modifiedChunks;
  }

  private disposeStaleTimeChunks(currentTimeIndex: number): Chunk[] {
    const disposedChunks: Chunk[] = [];
    for (const t of this.tIndicesWithQueuedChunks_) {
      const delta = t - currentTimeIndex;
      if (delta >= 0 && delta <= this.policy_.prefetch.t) continue;
      const chunks = this.chunks_[t];
      for (const chunk of chunks) {
        this.disposeChunk(chunk);
        disposedChunks.push(chunk);
      }
      this.tIndicesWithQueuedChunks_.delete(t);
    }
    return disposedChunks;
  }

  private updateChunksAtTimeIndex(
    timeIndex: number,
    viewBounds3D: Box3,
    viewBounds2DCenter: ReadonlyVec2
  ) {
    const paddedBounds = this.getPaddedBounds(viewBounds3D);

    const currentTimeChunks = this.chunks_[timeIndex];
    this.tIndicesWithQueuedChunks_.add(timeIndex);
    for (const chunk of currentTimeChunks) {
      const isVisible = this.isChunkWithinBounds(chunk, viewBounds3D);
      const isChannelInSlice = this.isChunkChannelInSlice(chunk);
      const eligibleForPrefetch =
        !isVisible &&
        isChannelInSlice &&
        this.isChunkWithinBounds(chunk, paddedBounds);

      const isCurrentLOD = chunk.lod === this.currentLOD_;
      const isFallbackLOD = chunk.lod === this.lowestResLOD_;
      const isLoaded = chunk.state === "loaded";

      chunk.visible = isVisible;
      chunk.prefetch = eligibleForPrefetch && isCurrentLOD && !isLoaded;
      chunk.priority = this.computePriority(
        isFallbackLOD,
        isCurrentLOD,
        isVisible,
        chunk.prefetch,
        isChannelInSlice
      );

      if (chunk.priority !== null && chunk.state === "unloaded") {
        chunk.state = "queued";
      } else if (chunk.priority === null && chunk.state === "queued") {
        chunk.state = "unloaded";
        chunk.orderKey = null;
      }

      if (chunk.priority !== null) {
        chunk.orderKey = this.squareDistance2D(chunk, viewBounds2DCenter);
      }

      if (
        this.shouldDispose(
          isLoaded,
          isFallbackLOD,
          isCurrentLOD,
          isVisible,
          chunk.prefetch,
          isChannelInSlice
        )
      ) {
        this.disposeChunk(chunk);
      }
    }
    return currentTimeChunks;
  }

  private markTimeChunksForPrefetch(
    currentTimeIndex: number,
    viewBounds3D: Box3,
    viewBoundsCenter2D: ReadonlyVec2
  ): Chunk[] {
    const tEnd = Math.min(
      this.chunks_.length - 1,
      currentTimeIndex + this.policy_.prefetch.t
    );
    const prefetchedChunks: Chunk[] = [];
    for (let t = currentTimeIndex + 1; t <= tEnd; ++t) {
      for (const chunk of this.chunks_[t]) {
        if (chunk.state !== "unloaded") continue;
        if (chunk.lod !== this.lowestResLOD_) continue;
        if (!this.isChunkChannelInSlice(chunk)) continue;
        if (!this.isChunkWithinBounds(chunk, viewBounds3D)) continue;
        chunk.prefetch = true;
        chunk.priority = this.policy_.priorityMap["prefetchTime"];
        const squareDistance = this.squareDistance2D(chunk, viewBoundsCenter2D);
        const normalizedDistance = clamp(
          squareDistance / this.sourceMaxSquareDistance2D_,
          0,
          1 - Number.EPSILON
        );
        chunk.orderKey = t - currentTimeIndex + normalizedDistance;
        chunk.state = "queued";
        this.tIndicesWithQueuedChunks_.add(t);
        prefetchedChunks.push(chunk);
      }
    }
    return prefetchedChunks;
  }

  private isChunkChannelInSlice(chunk: Chunk): boolean {
    return (
      this.sliceCoords_.c === undefined ||
      this.sliceCoords_.c === chunk.chunkIndex.c
    );
  }

  private shouldDispose(
    isLoaded: boolean,
    isFallbackLOD: boolean,
    isCurrentLOD: boolean,
    isVisible: boolean,
    isPrefetch: boolean,
    isChannelInSlice: boolean
  ) {
    if (!isLoaded) return false;
    if (!isChannelInSlice) return true;
    if (isFallbackLOD) return false;
    if (!isCurrentLOD) return true;
    return !isVisible && !isPrefetch;
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
    isPrefetch: boolean,
    isChannelInSlice: boolean
  ) {
    if (!isChannelInSlice) return null;

    const m = this.policy_.priorityMap;
    if (isFallbackLOD && isVisible) return m["fallbackVisible"];
    if (isCurrentLOD && isVisible) return m["visibleCurrent"];
    if (isFallbackLOD) return m["fallbackBackground"];
    if (isCurrentLOD && isPrefetch) return m["prefetchSpace"];

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

  private getAndValidateChannelDimension() {
    for (let lod = 0; lod < this.dimensions_.numLods; ++lod) {
      const cLod = this.dimensions_.c?.lods[lod];
      if (!cLod) continue;
      if (cLod.chunkSize !== 1) {
        throw new Error(
          `ChunkManager only supports a chunk size of 1 in c. Found ${cLod.chunkSize} at LOD ${lod}`
        );
      }
      if (cLod.scale !== 1) {
        throw new Error(
          `ChunkManager does not support scale in c. Found ${cLod.scale} at LOD ${lod}`
        );
      }
      if (cLod.translation !== 0) {
        throw new Error(
          `ChunkManager does not support translation in c. Found ${cLod.translation} at LOD ${lod}`
        );
      }
      const prevCLod = this.dimensions_.c?.lods[lod - 1];
      if (!prevCLod) continue;
      if (cLod.size !== prevCLod.size) {
        throw new Error(
          `ChunkManager does not support downsampling in c. Found ${prevCLod.size} at LOD ${lod - 1} → ${cLod.size} at LOD ${lod}`
        );
      }
    }
    return {
      size: this.dimensions_.c?.lods[0].size ?? 1,
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
    const zLod = this.dimensions_.z?.lods[this.currentLOD_];

    const padX = xLod.chunkSize * xLod.scale * this.policy_.prefetch.x;
    const padY = yLod.chunkSize * yLod.scale * this.policy_.prefetch.y;

    let padZ = 0;
    if (zLod) {
      padZ = zLod.chunkSize * zLod.scale * this.policy_.prefetch.z;
    }

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

  private squareDistance2D(chunk: Chunk, center: ReadonlyVec2): number {
    const chunkCenter = {
      x: chunk.offset.x + 0.5 * chunk.shape.x * chunk.scale.x,
      y: chunk.offset.y + 0.5 * chunk.shape.y * chunk.scale.y,
    };
    const dx = chunkCenter.x - center[0];
    const dy = chunkCenter.y - center[1];
    return dx * dx + dy * dy;
  }
}
