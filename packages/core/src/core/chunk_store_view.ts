import { Chunk, SliceCoordinates, ChunkUpdate } from "../data/chunk";
import { ChunkStore } from "./chunk_store";
import { Viewport } from "./viewport";
import { OrthographicCamera } from "../objects/cameras/orthographic_camera";
import { ReadonlyVec2, vec2, vec3 } from "gl-matrix";
import { Box2 } from "../math/box2";
import { Box3 } from "../math/box3";
import { Logger } from "../utilities/logger";
import { clamp } from "../utilities/clamp";

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

/**
 * ChunkStoreView provides a viewport-specific view into a ChunkStore.
 * It handles LOD calculation, chunk visibility determination, and prefetching
 * for a single viewport viewing the data source managed by the ChunkStore.
 */
export class ChunkStoreView {
  private readonly store_: ChunkStore;
  private readonly _viewport_: Viewport;
  private currentLOD_: number = 0;
  // TODO: make LOD bias configurable per-source or per-layer
  // positive values nudge towards coarser resolution (higher LOD number)
  private lodBias_: number = 0.5;
  private lastViewBounds2D_: Box2 | null = null;
  private lastZBounds_?: [number, number];
  private lastTCoord_?: number;

  public prioritizePrefetchTime: boolean = false;
  private tIndicesWithQueuedChunks_: Set<number> = new Set();
  private sourceMaxSquareDistance2D_: number;
  private pendingUpdates_: ChunkUpdate[] = [];

  constructor(store: ChunkStore, viewport: Viewport) {
    this.store_ = store;
    this._viewport_ = viewport;

    const dimensions = this.store_.dimensions;
    const xLod0 = dimensions.x.lods[0];
    const yLod0 = dimensions.y.lods[0];
    this.sourceMaxSquareDistance2D_ = vec2.squaredLength(
      vec2.fromValues(xLod0.size * xLod0.scale, yLod0.size * yLod0.scale)
    );
  }

  /**
   * Returns the chunks to render for the current viewport and slice position.
   * This includes both current LOD chunks and fallback chunks.
   * Uses per-view visibility state rather than aggregated state.
   */
  public getChunks(sliceCoords: SliceCoordinates): Chunk[] {
    const currentTimeIndex = this.store_.getTimeIndex(sliceCoords);
    const currentTimeChunks = this.store_.getChunksAtTime(currentTimeIndex);
    const currentLODChunks = currentTimeChunks.filter(
      (chunk) =>
        chunk.lod === this.currentLOD_ &&
        chunk.viewStates.get(this)?.visible === true &&
        chunk.state === "loaded"
    );

    // If we're at the lowest resolution LOD, only return current LOD chunks
    const lowestResLOD = this.store_.getLowestResLOD();
    if (this.currentLOD_ === lowestResLOD) {
      return currentLODChunks;
    }

    const lowResChunks = currentTimeChunks.filter(
      (chunk) =>
        chunk.lod === lowestResLOD &&
        chunk.viewStates.get(this)?.visible === true &&
        chunk.state === "loaded"
    );

    return [...lowResChunks, ...currentLODChunks];
  }

  /**
   * Updates chunk visibility and priority based on viewport camera and slice coordinates.
   * Stores the list of chunks that had their state modified internally.
   * Call consumeUpdatedChunks() to retrieve and clear this list.
   */
  public updateAndCollectChunkChanges(sliceCoords: SliceCoordinates): void {
    // Calculate LOD from viewport camera
    const camera = this._viewport_.camera;
    if (camera.type !== "OrthographicCamera") {
      throw new Error(
        "ChunkStoreView currently supports only orthographic cameras. " +
          "Update the implementation before using a perspective camera."
      );
    }

    const orthoCamera = camera as OrthographicCamera;
    const viewBounds2D = orthoCamera.getWorldViewRect();
    const virtualWidth = Math.abs(viewBounds2D.max[0] - viewBounds2D.min[0]);
    const canvasElement = this._viewport_.element as HTMLCanvasElement;
    const bufferWidth = this._viewport_
      .getBoxRelativeTo(canvasElement)
      .toRect().width;
    const virtualUnitsPerScreenPixel = virtualWidth / bufferWidth;
    const lodFactor = Math.log2(1 / virtualUnitsPerScreenPixel);

    this.setLOD(lodFactor);
    const zBounds = this.getZBounds(sliceCoords);

    if (
      this.viewBounds2DChanged(viewBounds2D) ||
      this.zBoundsChanged(zBounds) ||
      this.lastTCoord_ !== sliceCoords.t
    ) {
      this.pendingUpdates_ = this.updateAndCollectChunkChangesForCurrentLod(
        sliceCoords,
        viewBounds2D
      );
    } else {
      this.pendingUpdates_ = [];
    }

    this.lastViewBounds2D_ = viewBounds2D.clone();
    this.lastZBounds_ = zBounds;
    this.lastTCoord_ = sliceCoords.t;
  }

  public get currentLOD(): number {
    return this.currentLOD_;
  }

  /**
   * Consumes and clears the list of updated chunks.
   * This should be called by ChunkStore during ChunkManager.update().
   */
  public consumeUpdatedChunks(): ChunkUpdate[] {
    const updates = this.pendingUpdates_;
    this.pendingUpdates_ = [];
    return updates;
  }

  private setLOD(lodFactor: number): void {
    // `scale` here is the x-width of an image pixel in virtual units at LOD 0.
    // So (ignoring the bias term) subtracting `lodFactor` from `Math.log2(scale)`
    // is effectively `Math.log2(virtualUnitsPerScreenPixel / xScale)`.
    // That is, `adjustedLodFactor = Math.log2(imagePixelsPerScreenPixel)`;
    // or in other words, how many image pixels (LOD 0) fit in a screen pixel.
    // Use of log2 here and in ChunkManager relies on the assumption that
    // each LOD is downsampled by a factor of 2 in X and Y.
    const dimensions = this.store_.dimensions;
    const sourceAdjustment =
      this.lodBias_ - Math.log2(dimensions.x.lods[0].scale);
    const sourceAdjustedLodFactor = sourceAdjustment - lodFactor;
    const maxLOD = this.store_.getLowestResLOD();
    const targetLOD = Math.max(
      0,
      Math.min(maxLOD, Math.floor(sourceAdjustedLodFactor))
    );

    if (targetLOD !== this.currentLOD_) {
      Logger.debug(
        "ChunkStoreView",
        `LOD changed from ${this.currentLOD_} to ${targetLOD}`
      );
      this.currentLOD_ = targetLOD;
    }
  }

  private updateAndCollectChunkChangesForCurrentLod(
    sliceCoords: SliceCoordinates,
    viewBounds2D: Box2
  ): ChunkUpdate[] {
    const currentTimeIndex = this.store_.getTimeIndex(sliceCoords);
    const currentTimeChunks = this.store_.getChunksAtTime(currentTimeIndex);

    if (currentTimeChunks.length === 0) {
      Logger.warn(
        "ChunkStoreView",
        "updateChunkVisibility called with no chunks initialized"
      );
      return [];
    }

    const viewBoundsCenter2D = vec2.create();
    vec2.lerp(viewBoundsCenter2D, viewBounds2D.min, viewBounds2D.max, 0.5);

    const [zMin, zMax] = this.getZBounds(sliceCoords);
    const viewBounds3D = new Box3(
      vec3.fromValues(viewBounds2D.min[0], viewBounds2D.min[1], zMin),
      vec3.fromValues(viewBounds2D.max[0], viewBounds2D.max[1], zMax)
    );

    const updates: ChunkUpdate[] = [];

    if (sliceCoords.t !== undefined) {
      const staleTimeUpdates = this.updateStaleTimeChunks(currentTimeIndex);
      updates.push(...staleTimeUpdates);
    }

    const currentTimeUpdates = this.updateChunksAtTimeIndex(
      currentTimeIndex,
      viewBounds3D,
      viewBoundsCenter2D,
      sliceCoords
    );
    updates.push(...currentTimeUpdates);

    if (sliceCoords.t !== undefined) {
      const prefetchUpdates = this.markTimeChunksForPrefetch(
        currentTimeIndex,
        viewBounds3D,
        viewBoundsCenter2D
      );
      updates.push(...prefetchUpdates);
    }

    return updates;
  }

  private updateStaleTimeChunks(currentTimeIndex: number): ChunkUpdate[] {
    const updates: ChunkUpdate[] = [];
    for (const t of this.tIndicesWithQueuedChunks_) {
      const delta = t - currentTimeIndex;
      if (delta >= 0 && delta <= PREFETCH_TIME_POINTS) continue;
      const chunks = this.store_.getChunksAtTime(t);
      for (const chunk of chunks) {
        // Mark this chunk as not needed by this view anymore
        updates.push({
          chunk,
          viewState: {
            visible: false,
            prefetch: false,
            priority: null,
            orderKey: null,
          },
        });
      }
      this.tIndicesWithQueuedChunks_.delete(t);
    }
    return updates;
  }

  private isChunkChannelInSlice(
    chunk: Chunk,
    sliceCoords: SliceCoordinates
  ): boolean {
    return (
      sliceCoords.c === undefined || sliceCoords.c === chunk.chunkIndex.c
    );
  }

  private updateChunksAtTimeIndex(
    timeIndex: number,
    viewBounds3D: Box3,
    viewBounds2DCenter: ReadonlyVec2,
    sliceCoords: SliceCoordinates
  ): ChunkUpdate[] {
    const paddedBounds = this.getPaddedBounds(viewBounds3D);
    const updates: ChunkUpdate[] = [];

    const currentTimeChunks = this.store_.getChunksAtTime(timeIndex);
    this.tIndicesWithQueuedChunks_.add(timeIndex);

    for (const chunk of currentTimeChunks) {
      const isVisible = this.isChunkWithinBounds(chunk, viewBounds3D);
      const isChannelInSlice = this.isChunkChannelInSlice(chunk, sliceCoords);
      const eligibleForPrefetch =
        !isVisible &&
        isChannelInSlice &&
        this.isChunkWithinBounds(chunk, paddedBounds);

      const isCurrentLOD = chunk.lod === this.currentLOD_;
      const isFallbackLOD = chunk.lod === this.store_.getLowestResLOD();
      const isLoaded = chunk.state === "loaded";

      const visible = isVisible && isChannelInSlice;
      const prefetch = eligibleForPrefetch && isCurrentLOD && !isLoaded;
      const priority = this.computePriority(
        isFallbackLOD,
        isCurrentLOD,
        isVisible,
        prefetch,
        isChannelInSlice
      );

      const orderKey = priority !== null
        ? this.squareDistance2D(chunk, viewBounds2DCenter)
        : null;

      updates.push({
        chunk,
        viewState: {
          visible,
          prefetch,
          priority,
          orderKey,
        },
      });
    }

    return updates;
  }

  private markTimeChunksForPrefetch(
    currentTimeIndex: number,
    viewBounds3D: Box3,
    viewBoundsCenter2D: ReadonlyVec2
  ): ChunkUpdate[] {
    const numTimePoints = this.store_.dimensions.t?.lods[0].size ?? 1;
    const tEnd = Math.min(
      numTimePoints - 1,
      currentTimeIndex + PREFETCH_TIME_POINTS
    );
    const updates: ChunkUpdate[] = [];
    for (let t = currentTimeIndex + 1; t <= tEnd; ++t) {
      for (const chunk of this.store_.getChunksAtTime(t)) {
        if (chunk.state !== "unloaded") continue;
        if (chunk.lod !== this.store_.getLowestResLOD()) continue;
        if (!this.isChunkWithinBounds(chunk, viewBounds3D)) continue;

        const priority = this.prioritizePrefetchTime
          ? PRI_PREFETCH_TIME_HIGH
          : PRI_PREFETCH_TIME_LOW;
        const squareDistance = this.squareDistance2D(chunk, viewBoundsCenter2D);
        const normalizedDistance = clamp(
          squareDistance / this.sourceMaxSquareDistance2D_,
          0,
          1 - Number.EPSILON
        );
        const orderKey = t - currentTimeIndex + normalizedDistance;

        this.tIndicesWithQueuedChunks_.add(t);
        updates.push({
          chunk,
          viewState: {
            visible: false,
            prefetch: true,
            priority,
            orderKey,
          },
        });
      }
    }
    return updates;
  }

  private computePriority(
    isFallbackLOD: boolean,
    isCurrentLOD: boolean,
    isVisible: boolean,
    isPrefetch: boolean,
    isChannelInSlice: boolean
  ) {
    if (!isChannelInSlice) return null;
    if (isFallbackLOD && isVisible) return PRI_FALLBACK_VISIBLE;
    if (isCurrentLOD && isVisible) return PRI_VISIBLE_CURRENT;
    if (isFallbackLOD) return PRI_FALLBACK_BACKGROUND;
    if (isCurrentLOD && isPrefetch) return PRI_PREFETCH_SPACE;
    return null;
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

  private getZBounds(sliceCoords: SliceCoordinates): [number, number] {
    const zDim = this.store_.dimensions.z;
    if (zDim === undefined || sliceCoords.z === undefined) return [0, 1];

    const zLod = zDim.lods[this.currentLOD_];
    const zShape = zLod.size;
    const zScale = zLod.scale;
    const zTran = zLod.translation;
    const zPoint = Math.floor((sliceCoords.z - zTran) / zScale);
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
    const dimensions = this.store_.dimensions;
    const xLod = dimensions.x.lods[this.currentLOD_];
    const yLod = dimensions.y.lods[this.currentLOD_];

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
