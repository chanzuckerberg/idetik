import {
  AxisComponent,
  Chunk,
  ChunkViewState,
  coordToIndex,
  SliceAxes,
  SliceCoordinates,
  SpatialAxis,
} from "./chunk";
import type { ChunkStore } from "./chunk_store";
import { ImageSourcePolicy } from "../core/image_source_policy";
import { ReadonlyVec2, vec2, vec3, mat4 } from "gl-matrix";
import { Box2 } from "../math/box2";
import { Box3 } from "../math/box3";
import { Logger } from "../utilities/logger";
import { clamp } from "../utilities/clamp";

/*
Unique symbol used as a capability token to allow internal modules to update
the image source policy. Only code that imports this symbol can call
setImageSourcePolicy; all other callers will be rejected. Acts like a "friend"
access key, preventing accidental external mutation.
*/
export const INTERNAL_POLICY_KEY = Symbol("INTERNAL_POLICY_KEY");

export class ChunkStoreView {
  private readonly store_: ChunkStore;
  private policy_: ImageSourcePolicy;
  private policyChanged_ = false;
  private currentLOD_: number = 0;
  private readonly axes_: SliceAxes = { u: "x", v: "y", w: "z" };
  private readonly scale0_: number;
  private lastViewBounds2D_: Box2 | null = null;
  private lastViewProjection_: mat4 | null = null;
  private lastSliceBounds_?: [number, number];
  private lastTCoord_?: number;
  private lastCCoords_?: number[];

  private readonly sourceMaxSquareDistance2D_: number;
  private readonly chunkViewStates_: Map<Chunk, ChunkViewState> = new Map();

  private isDisposed_ = false;

  constructor(store: ChunkStore, policy: ImageSourcePolicy) {
    this.store_ = store;
    this.policy_ = policy;

    Logger.info(
      "ChunkStoreView",
      "Using image source policy:",
      this.policy_.profile
    );

    const dimensions = this.store_.dimensions;
    const uDim = dimensions[this.axes_.u];
    const vDim = dimensions[this.axes_.v];
    if (uDim === undefined || vDim === undefined) {
      throw new Error(
        `Source is missing dimensions for slice plane axes ` +
          `"${this.axes_.u}" and "${this.axes_.v}"`
      );
    }

    const uLod0 = uDim.lods[0];
    const vLod0 = vDim.lods[0];
    this.scale0_ = uLod0.scale;
    this.sourceMaxSquareDistance2D_ = vec2.squaredLength(
      vec2.fromValues(uLod0.size * uLod0.scale, vLod0.size * vLod0.scale)
    );
  }

  public get chunkViewStates(): ReadonlyMap<Chunk, ChunkViewState> {
    return this.chunkViewStates_;
  }

  public get isDisposed(): boolean {
    return this.isDisposed_;
  }

  public get lodCount(): number {
    return this.store_.lodCount;
  }

  public get channelCount(): number {
    return this.store_.channelCount;
  }

  public getChunksToRender(): Chunk[] {
    // Iterates `chunkViewStates_` (only chunks touched by the most recent
    // updateChunks*ForRegion) instead of every chunk at the time index, so the
    // cost is bounded by visible+prefetch+fallback set size, not dataset size.
    const fallbackLOD = this.fallbackLOD();
    const currentLOD = this.currentLOD_;
    const currentLODChunks: Chunk[] = [];
    const lowResChunks: Chunk[] = [];

    for (const [chunk, state] of this.chunkViewStates_) {
      if (!state.visible || chunk.state !== "loaded" || !chunk.texture)
        continue;
      if (chunk.lod === currentLOD) {
        currentLODChunks.push(chunk);
      } else if (chunk.lod === fallbackLOD && currentLOD !== fallbackLOD) {
        lowResChunks.push(chunk);
      }
    }

    return [...currentLODChunks, ...lowResChunks];
  }

  public updateChunksForImage(
    sliceCoords: SliceCoordinates,
    view: { worldViewRect: Box2; bufferWidthPx: number }
  ): void {
    const viewBounds2D = view.worldViewRect;
    const virtualWidth = Math.abs(viewBounds2D.max[0] - viewBounds2D.min[0]);
    const virtualUnitsPerScreenPixel = virtualWidth / view.bufferWidthPx;
    const lodFactor = Math.log2(1 / virtualUnitsPerScreenPixel);

    this.setLOD(lodFactor);

    const sliceBounds = this.getSliceAxisBounds(sliceCoords);
    const changed =
      this.policyChanged_ ||
      this.viewBounds2DChanged(viewBounds2D) ||
      this.sliceBoundsChanged(sliceBounds) ||
      this.lastTCoord_ !== sliceCoords.t ||
      this.cCoordsChanged(sliceCoords.c);

    if (!changed) return;

    const currentTimeIndex = this.timeIndex(sliceCoords);
    if (!this.store_.hasChunksAtTime(currentTimeIndex)) {
      Logger.warn(
        "ChunkStoreView",
        "updateChunkViewStates called with no chunks initialized"
      );
      this.chunkViewStates_.forEach(resetChunkViewState);
      return;
    }

    const viewBoundsCenter2D = vec2.create();
    vec2.lerp(viewBoundsCenter2D, viewBounds2D.min, viewBounds2D.max, 0.5);

    const viewBounds3D = this.makeViewBounds3D(viewBounds2D, sliceBounds);

    // reset all existing chunk view states to "not needed" to start
    // logic below will override this for chunks that are actually visible/prefetch
    this.chunkViewStates_.forEach(resetChunkViewState);

    const channels = this.channelsOfInterest(sliceCoords);
    const fallbackLOD = this.fallbackLOD();
    const prefetchAabb = this.getPaddedBounds(viewBounds3D);

    // Range-query the prefetch AABB at currentLOD (and fallbackLOD when
    // distinct); fallback chunks act as a backdrop while currentLOD loads.
    const lodsToVisit =
      this.currentLOD_ === fallbackLOD
        ? [this.currentLOD_]
        : [this.currentLOD_, fallbackLOD];
    for (const lod of lodsToVisit) {
      const isCurrent = lod === this.currentLOD_;
      const isFallback = lod === fallbackLOD;
      this.iterateChunksInBox(
        currentTimeIndex,
        lod,
        channels,
        prefetchAabb,
        (chunk, chunkBox) => {
          const isInBounds = Box3.intersects(chunkBox, viewBounds3D);
          const prefetch = isCurrent && !isInBounds;
          const priority = this.computePriority(
            isFallback,
            isCurrent,
            isInBounds,
            prefetch,
            true
          );
          if (priority !== null) {
            this.chunkViewStates_.set(chunk, {
              visible: isInBounds,
              prefetch,
              priority,
              orderKey: this.squareDistance2D(chunk, viewBoundsCenter2D),
            });
          }
        }
      );
    }

    this.markTimeChunksForPrefetchImage(
      currentTimeIndex,
      sliceCoords,
      viewBounds3D,
      viewBoundsCenter2D
    );

    this.policyChanged_ = false;
    this.lastViewBounds2D_ = viewBounds2D.clone();
    this.lastSliceBounds_ = sliceBounds;
    this.lastTCoord_ = sliceCoords.t;
    this.lastCCoords_ = sliceCoords.c ? [...sliceCoords.c] : undefined;
  }

  public updateChunksForVolume(
    sliceCoords: SliceCoordinates,
    viewProjection: mat4
  ): void {
    const changed =
      this.policyChanged_ ||
      this.hasViewProjectionChanged(viewProjection) ||
      this.lastTCoord_ !== sliceCoords.t ||
      this.cCoordsChanged(sliceCoords.c);

    if (!changed) return;

    const currentTimeIndex = this.timeIndex(sliceCoords);
    if (!this.store_.hasChunksAtTime(currentTimeIndex)) {
      Logger.warn(
        "ChunkStoreView",
        "updateChunksForVolume called with no chunks initialized"
      );
      this.chunkViewStates_.forEach(resetChunkViewState);
      return;
    }

    // TODO: Calculate LOD dynamically based on view frustum for volume rendering
    // (similar to zoom-based LOD calculation in updateChunksForImage).
    // Currently uses a fixed LOD from policy.
    this.currentLOD_ = this.policy_.lod.min;

    this.chunkViewStates_.forEach(resetChunkViewState);

    const channels = this.channelsOfInterest(sliceCoords);
    const fallbackLOD = this.fallbackLOD();

    const markVolumeChunkVisible = (chunk: Chunk) => {
      const isFallbackLOD = chunk.lod === fallbackLOD;
      const isCurrentLOD = chunk.lod === this.currentLOD_;
      const priority = this.computePriority(
        isFallbackLOD,
        isCurrentLOD,
        true,
        false,
        true
      );
      if (priority === null) return;
      this.chunkViewStates_.set(chunk, {
        visible: true,
        prefetch: false,
        priority,
        orderKey: 0,
      });
    };
    this.iterateAllChunksAtLod(
      currentTimeIndex,
      this.currentLOD_,
      channels,
      markVolumeChunkVisible
    );
    if (this.currentLOD_ !== fallbackLOD) {
      this.iterateAllChunksAtLod(
        currentTimeIndex,
        fallbackLOD,
        channels,
        markVolumeChunkVisible
      );
    }

    this.markTimeChunksForPrefetchVolume(currentTimeIndex, sliceCoords);

    this.policyChanged_ = false;
    this.lastTCoord_ = sliceCoords.t;
    this.lastCCoords_ = sliceCoords.c ? [...sliceCoords.c] : undefined;
    this.lastViewProjection_ = viewProjection;
  }

  public allVisibleFallbackLODLoaded(): boolean {
    const fallbackLOD = this.fallbackLOD();
    let foundAny = false;
    for (const [chunk, state] of this.chunkViewStates_) {
      if (!state.visible || chunk.lod !== fallbackLOD) continue;
      foundAny = true;
      if (chunk.texture === undefined) return false;
    }
    return foundAny;
  }

  public get currentLOD(): number {
    return this.currentLOD_;
  }

  public maybeForgetChunk(chunk: Chunk): void {
    const viewState = this.chunkViewStates_.get(chunk);
    if (
      viewState &&
      (viewState.visible || viewState.prefetch || viewState.priority !== null)
    ) {
      return;
    }
    this.chunkViewStates_.delete(chunk);
  }

  public dispose(): void {
    this.isDisposed_ = true;
    this.chunkViewStates_.forEach(resetChunkViewState);
  }

  public setImageSourcePolicy(newPolicy: ImageSourcePolicy, key: symbol) {
    if (key !== INTERNAL_POLICY_KEY) {
      throw new Error("Unauthorized policy mutation");
    }

    if (this.policy_ !== newPolicy) {
      this.policy_ = newPolicy;
      this.policyChanged_ = true;

      Logger.info(
        "ChunkStoreView",
        "Using image source policy:",
        this.policy_.profile
      );
    }
  }

  private setLOD(lodFactor: number): void {
    // With 2x downsampling per LOD, selection happens in log2 space.
    const bias = this.policy_.lod.bias;

    // How many LOD 0 pixels per screen pixel, normalized by source scale and bias.
    const sourceAdjusted = bias - Math.log2(this.scale0_) - lodFactor;
    const desiredLOD = Math.floor(sourceAdjusted);

    const lowestResLOD = this.store_.getLowestResLOD();
    // Intersect dataset bounds with policy bounds.
    const minPolicyLOD = Math.max(
      0,
      Math.min(lowestResLOD, this.policy_.lod.min)
    );
    const maxPolicyLOD = Math.max(
      minPolicyLOD,
      Math.min(lowestResLOD, this.policy_.lod.max)
    );

    const target = clamp(desiredLOD, minPolicyLOD, maxPolicyLOD);
    if (target !== this.currentLOD_) {
      this.currentLOD_ = target;
    }
  }

  private markTimeChunksForPrefetchImage(
    currentTimeIndex: number,
    sliceCoords: SliceCoordinates,
    viewBounds3D: Box3,
    viewBoundsCenter2D: ReadonlyVec2
  ): void {
    const numTimePoints = this.store_.dimensions.t?.lods[0].size ?? 1;
    const windowSize = Math.min(this.policy_.prefetch.t, numTimePoints - 1);
    const fallbackLOD = this.fallbackLOD();
    const priority = this.policy_.priorityMap["prefetchTime"];
    const channels = this.channelsOfInterest(sliceCoords);

    for (let i = 1; i <= windowSize; ++i) {
      const t = (currentTimeIndex + i) % numTimePoints;
      this.iterateChunksInBox(
        t,
        fallbackLOD,
        channels,
        viewBounds3D,
        (chunk) => {
          const squareDistance = this.squareDistance2D(
            chunk,
            viewBoundsCenter2D
          );
          const normalizedDistance = clamp(
            squareDistance / this.sourceMaxSquareDistance2D_,
            0,
            1 - Number.EPSILON
          );
          const orderKey = i + normalizedDistance;

          this.chunkViewStates_.set(chunk, {
            visible: false,
            prefetch: true,
            priority,
            orderKey,
          });
        }
      );
    }
  }

  private markTimeChunksForPrefetchVolume(
    currentTimeIndex: number,
    sliceCoords: SliceCoordinates
  ) {
    const numTimePoints = this.store_.dimensions.t?.lods[0].size ?? 1;
    const windowSize = Math.min(this.policy_.prefetch.t, numTimePoints - 1);
    const fallbackLOD = this.fallbackLOD();
    const priority = this.policy_.priorityMap["prefetchTime"];
    const channels = this.channelsOfInterest(sliceCoords);

    for (let i = 1; i <= windowSize; ++i) {
      const t = (currentTimeIndex + i) % numTimePoints;
      this.iterateAllChunksAtLod(t, fallbackLOD, channels, (chunk) => {
        const orderKey = i; // nearer along the playback loop first
        this.chunkViewStates_.set(chunk, {
          visible: false,
          prefetch: true,
          priority,
          orderKey,
        });
      });
    }
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

  private channelsOfInterest(sliceCoords: SliceCoordinates): number[] {
    return (
      sliceCoords.c ??
      Array.from({ length: this.store_.channelCount }, (_, i) => i)
    );
  }

  // Half-open chunk-index range [min, max) at a given LOD that covers `bounds`.
  // Returns null if the bounds don't overlap the data grid.
  private chunkIndexRange(bounds: Box3, lod: number) {
    const dim = this.store_.dimensions;
    const xLod = dim.x.lods[lod];
    const yLod = dim.y.lods[lod];
    const zLod = dim.z?.lods[lod];

    const xCount = Math.ceil(xLod.size / xLod.chunkSize);
    const yCount = Math.ceil(yLod.size / yLod.chunkSize);
    const zCount = zLod ? Math.ceil(zLod.size / zLod.chunkSize) : 1;

    const xStride = xLod.chunkSize * xLod.scale;
    const yStride = yLod.chunkSize * yLod.scale;
    const zStride = zLod ? zLod.chunkSize * zLod.scale : 1;
    const xTran = xLod.translation;
    const yTran = yLod.translation;
    const zTran = zLod?.translation ?? 0;

    const xMin = Math.max(0, Math.floor((bounds.min[0] - xTran) / xStride));
    const xMax = Math.min(xCount, Math.ceil((bounds.max[0] - xTran) / xStride));
    const yMin = Math.max(0, Math.floor((bounds.min[1] - yTran) / yStride));
    const yMax = Math.min(yCount, Math.ceil((bounds.max[1] - yTran) / yStride));
    const zMin = zLod
      ? Math.max(0, Math.floor((bounds.min[2] - zTran) / zStride))
      : 0;
    const zMax = zLod
      ? Math.min(zCount, Math.ceil((bounds.max[2] - zTran) / zStride))
      : 1;

    if (xMin >= xMax || yMin >= yMax || zMin >= zMax) return null;
    return { xMin, xMax, yMin, yMax, zMin, zMax };
  }

  private iterateChunksInBox(
    timeIndex: number,
    lod: number,
    channels: number[],
    bounds: Box3,
    callback: (chunk: Chunk, chunkBox: Box3) => void
  ): void {
    const range = this.chunkIndexRange(bounds, lod);
    if (!range) return;
    for (const c of channels) {
      const grid = this.store_.getChunkGrid(lod, timeIndex, c);
      if (!grid) continue;
      for (let zi = range.zMin; zi < range.zMax; ++zi) {
        const yPlane = grid[zi];
        for (let yi = range.yMin; yi < range.yMax; ++yi) {
          const xRow = yPlane[yi];
          for (let xi = range.xMin; xi < range.xMax; ++xi) {
            const chunk = xRow[xi];
            callback(chunk, this.getChunkAabb(chunk));
          }
        }
      }
    }
  }

  private iterateAllChunksAtLod(
    timeIndex: number,
    lod: number,
    channels: number[],
    callback: (chunk: Chunk, chunkBox: Box3) => void
  ): void {
    for (const c of channels) {
      const grid = this.store_.getChunkGrid(lod, timeIndex, c);
      if (!grid) continue;
      for (const yPlane of grid) {
        for (const xRow of yPlane) {
          for (const chunk of xRow) {
            callback(chunk, this.getChunkAabb(chunk));
          }
        }
      }
    }
  }

  private getChunkAabb(chunk: Chunk): Box3 {
    return new Box3(
      vec3.fromValues(chunk.offset.x, chunk.offset.y, chunk.offset.z),
      vec3.fromValues(
        chunk.offset.x + chunk.shape.x * chunk.scale.x,
        chunk.offset.y + chunk.shape.y * chunk.scale.y,
        chunk.offset.z + chunk.shape.z * chunk.scale.z
      )
    );
  }

  private fallbackLOD(): number {
    return Math.min(this.policy_.lod.max, this.store_.getLowestResLOD());
  }

  private timeIndex(sliceCoords: SliceCoordinates): number {
    const tDim = this.store_.dimensions.t;
    if (sliceCoords.t === undefined || tDim === undefined) return 0;
    return coordToIndex(tDim.lods[0], sliceCoords.t);
  }

  private getSliceAxisBounds(sliceCoords: SliceCoordinates): [number, number] {
    const wDim = this.store_.dimensions[this.axes_.w];
    if (wDim === undefined) return [0, 1];

    const wLod = wDim.lods[this.currentLOD_];

    // If slice coordinate is undefined, return bounds that encompass the whole axis (for volume rendering)
    const sliceValue = sliceCoords[this.axes_.w];
    if (sliceValue === undefined) {
      return [wLod.translation, wLod.translation + wLod.size * wLod.scale];
    }

    const wShape = wLod.size;
    const wScale = wLod.scale;
    const wTran = wLod.translation;
    const wPoint = Math.floor((sliceValue - wTran) / wScale);
    const chunkDepth = wLod.chunkSize;

    const wChunk = Math.max(
      0,
      Math.min(
        Math.floor(wPoint / chunkDepth),
        Math.ceil(wShape / chunkDepth) - 1
      )
    );

    return [
      wTran + wChunk * chunkDepth * wScale,
      wTran + (wChunk + 1) * chunkDepth * wScale,
    ];
  }

  private makeViewBounds3D(
    viewBounds2D: Box2,
    sliceBounds: [number, number]
  ): Box3 {
    const min = vec3.create();
    const max = vec3.create();
    min[AxisComponent[this.axes_.u]] = viewBounds2D.min[0];
    max[AxisComponent[this.axes_.u]] = viewBounds2D.max[0];
    min[AxisComponent[this.axes_.v]] = viewBounds2D.min[1];
    max[AxisComponent[this.axes_.v]] = viewBounds2D.max[1];
    min[AxisComponent[this.axes_.w]] = sliceBounds[0];
    max[AxisComponent[this.axes_.w]] = sliceBounds[1];
    return new Box3(min, max);
  }

  private viewBounds2DChanged(newBounds: Box2): boolean {
    return (
      this.lastViewBounds2D_ === null ||
      !vec2.equals(this.lastViewBounds2D_.min, newBounds.min) ||
      !vec2.equals(this.lastViewBounds2D_.max, newBounds.max)
    );
  }

  private hasViewProjectionChanged(viewProjection: mat4) {
    return (
      this.lastViewProjection_ === null ||
      !mat4.equals(this.lastViewProjection_, viewProjection)
    );
  }

  private sliceBoundsChanged(newBounds: [number, number]): boolean {
    return (
      !this.lastSliceBounds_ || !vec2.equals(this.lastSliceBounds_, newBounds)
    );
  }

  private cCoordsChanged(newC?: number[]): boolean {
    if (!this.lastCCoords_ && !newC) return false;
    if (!this.lastCCoords_ || !newC) return true;
    if (this.lastCCoords_.length !== newC.length) return true;
    return !this.lastCCoords_.every((v, i) => v === newC[i]);
  }

  private getPaddedBounds(bounds: Box3): Box3 {
    const dimensions = this.store_.dimensions;
    const xLod = dimensions.x.lods[this.currentLOD_];
    const yLod = dimensions.y.lods[this.currentLOD_];
    const zLod = dimensions.z?.lods[this.currentLOD_];

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
    function axisCenter(axis: SpatialAxis) {
      return chunk.offset[axis] + 0.5 * chunk.shape[axis] * chunk.scale[axis];
    }

    const { u, v } = this.axes_;
    const du = axisCenter(u) - center[0];
    const dv = axisCenter(v) - center[1];

    return du * du + dv * dv;
  }
}

function resetChunkViewState(state: ChunkViewState): void {
  state.visible = false;
  state.prefetch = false;
  state.priority = null;
  state.orderKey = null;
}
