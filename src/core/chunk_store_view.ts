import {
  Chunk,
  SliceCoordinates,
  ChunkViewState,
  coordToIndex,
} from "../data/chunk";
import type { ChunkStore } from "./chunk_store";
import { Viewport } from "./viewport";
import { Camera } from "../objects/cameras/camera";
import { OrthographicCamera } from "../objects/cameras/orthographic_camera";
import { ImageSourcePolicy } from "./image_source_policy";
import { ReadonlyVec2, vec2, vec3, mat4 } from "gl-matrix";
import { Box3 } from "../math/box3";
import { Frustum } from "../math/frustum";
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
  private lastViewProjection_: mat4 | null = null;
  private lastSliceIdx_?: number;
  private lastTCoord_?: number;
  private lastCCoords_?: number[];

  private sourceMaxSquareDistance2D_: number;
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
    const xLod0 = dimensions.x.lods[0];
    const yLod0 = dimensions.y.lods[0];
    this.sourceMaxSquareDistance2D_ = vec2.squaredLength(
      vec2.fromValues(xLod0.size * xLod0.scale, yLod0.size * yLod0.scale)
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
      if (!state.visible || chunk.state !== "loaded") continue;
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
    viewport: Viewport
  ): void {
    const camera = viewport.camera;
    if (camera.type !== "OrthographicCamera") {
      throw new Error(
        "ChunkStoreView slice mode currently supports only orthographic cameras."
      );
    }

    const orthoCamera = camera as OrthographicCamera;
    const viewBounds2D = orthoCamera.getWorldViewRect();
    const virtualWidth = Math.abs(viewBounds2D.max[0] - viewBounds2D.min[0]);
    const canvasElement = viewport.element as HTMLCanvasElement;
    const bufferWidth = viewport.getBoxRelativeTo(canvasElement).toRect().width;
    const virtualUnitsPerScreenPixel = virtualWidth / bufferWidth;
    const lodFactor = Math.log2(1 / virtualUnitsPerScreenPixel);

    this.setLOD(lodFactor);

    // Slice slab on z, from the integer chunk index — no slab math, no
    // float-precision risk at chunk boundaries.
    const sliceIdx =
      sliceCoords.z !== undefined && this.store_.dimensions.z !== undefined
        ? this.store_.sliceChunkIndex("z", this.currentLOD_, sliceCoords.z)
        : 0;

    const viewProjection = mat4.multiply(
      mat4.create(),
      camera.projectionMatrix,
      camera.viewMatrix
    );

    const changed =
      this.policyChanged_ ||
      this.hasViewProjectionChanged(viewProjection) ||
      this.lastSliceIdx_ !== sliceIdx ||
      this.lastTCoord_ !== sliceCoords.t ||
      this.cCoordsChanged(sliceCoords.c);

    if (!changed) return;

    const currentTimeIndex = this.timeIndex(sliceCoords);
    if (!this.store_.hasChunksAtTime(currentTimeIndex)) {
      Logger.warn(
        "ChunkStoreView",
        "updateChunksForImage called with no chunks initialized"
      );
      this.chunkViewStates_.clear();
      return;
    }

    const viewBoundsCenter2D = vec2.create();
    vec2.lerp(viewBoundsCenter2D, viewBounds2D.min, viewBounds2D.max, 0.5);

    const [zMin, zMax] = this.sliceSlabBounds("z", sliceIdx);
    const viewBounds3D = new Box3(
      vec3.fromValues(viewBounds2D.min[0], viewBounds2D.min[1], zMin),
      vec3.fromValues(viewBounds2D.max[0], viewBounds2D.max[1], zMax)
    );
    const prefetchAabb = this.getPaddedBounds(viewBounds3D);

    this.chunkViewStates_.forEach(resetChunkViewState);

    const channels = this.channelsOfInterest(sliceCoords);
    const fallbackLOD = this.fallbackLOD();
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

    this.prefetchTimeChunksWithinBounds(
      currentTimeIndex,
      channels,
      viewBounds3D,
      viewBoundsCenter2D
    );

    this.policyChanged_ = false;
    this.lastViewProjection_ = viewProjection;
    this.lastSliceIdx_ = sliceIdx;
    this.lastTCoord_ = sliceCoords.t;
    this.lastCCoords_ = sliceCoords.c ? [...sliceCoords.c] : undefined;
  }

  public updateChunksForVolume(
    sliceCoords: SliceCoordinates,
    viewport: Viewport
  ): void {
    // Each call allocates a new mat4 and computes projection * view.
    // This is intentional for simplicity. If this ever shows up in profiles
    // avoid multiply entirely by caching and comparing view/projection separately.
    const viewProjection = mat4.multiply(
      mat4.create(),
      viewport.camera.projectionMatrix,
      viewport.camera.viewMatrix
    );

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
      this.chunkViewStates_.clear();
      return;
    }

    // TODO: derive volume LOD from frustum extent.
    this.currentLOD_ = this.policy_.lod.min;

    const visibleAabb = this.cameraFrustumWorldAabb(viewport.camera);
    const frustum = viewport.camera.frustum;

    this.chunkViewStates_.forEach(resetChunkViewState);

    const channels = this.channelsOfInterest(sliceCoords);
    const fallbackLOD = this.fallbackLOD();
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
        visibleAabb,
        (chunk, chunkBox) => {
          // visibleAabb (the world-AABB of the camera frustum) is the
          // tightest AABB iteration we can do, but for a perspective
          // frustum it's much looser than the frustum itself. Without the
          // precise frustum test, chunks at the AABB's corners would land
          // at `fallbackBackground` priority and stay loaded indefinitely.
          if (!frustum.intersectsWithBox3(chunkBox)) return;
          const priority = this.computePriority(
            isFallback,
            isCurrent,
            true,
            false,
            true
          );
          if (priority !== null) {
            this.chunkViewStates_.set(chunk, {
              visible: true,
              prefetch: false,
              priority,
              orderKey: 0,
            });
          }
        }
      );
    }

    this.prefetchTimeChunksAtFallback(
      currentTimeIndex,
      channels,
      visibleAabb,
      frustum
    );

    this.policyChanged_ = false;
    this.lastViewProjection_ = viewProjection;
    this.lastTCoord_ = sliceCoords.t;
    this.lastCCoords_ = sliceCoords.c ? [...sliceCoords.c] : undefined;
  }

  public allVisibleFallbackLODLoaded(): boolean {
    const fallbackLOD = this.fallbackLOD();
    let foundAny = false;
    for (const [chunk, state] of this.chunkViewStates_) {
      if (!state.visible || chunk.lod !== fallbackLOD) continue;
      foundAny = true;
      if (chunk.state !== "loaded") return false;
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
    // `scale0` is the x pixel size (world units) at LOD 0.
    // With 2x downsampling per LOD, selection happens in log2 space.
    const dimensions = this.store_.dimensions;
    const scale0 = dimensions.x.lods[0].scale;
    const bias = this.policy_.lod.bias;

    // How many LOD 0 pixels per screen pixel, normalized by source scale and bias.
    const sourceAdjusted = bias - Math.log2(scale0) - lodFactor;
    const desiredLOD = Math.floor(sourceAdjusted);

    const lowestResLOD = this.store_.getLowestResLOD();
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

  private prefetchTimeChunksWithinBounds(
    currentTimeIndex: number,
    channels: number[],
    viewBounds3D: Box3,
    viewBoundsCenter2D: ReadonlyVec2
  ): void {
    const numTimePoints = this.store_.dimensions.t?.lods[0].size ?? 1;
    const tEnd = Math.min(
      numTimePoints - 1,
      currentTimeIndex + this.policy_.prefetch.t
    );
    const fallbackLOD = this.fallbackLOD();
    const priority = this.policy_.priorityMap["prefetchTime"];

    for (let t = currentTimeIndex + 1; t <= tEnd; ++t) {
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
          const orderKey = t - currentTimeIndex + normalizedDistance;

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

  private prefetchTimeChunksAtFallback(
    currentTimeIndex: number,
    channels: number[],
    visibleAabb: Box3,
    frustum: Frustum
  ): void {
    const numTimePoints = this.store_.dimensions.t?.lods[0].size ?? 1;
    const tEnd = Math.min(
      numTimePoints - 1,
      currentTimeIndex + this.policy_.prefetch.t
    );
    const fallbackLOD = this.fallbackLOD();
    const priority = this.policy_.priorityMap["prefetchTime"];

    for (let t = currentTimeIndex + 1; t <= tEnd; ++t) {
      this.iterateChunksInBox(
        t,
        fallbackLOD,
        channels,
        visibleAabb,
        (chunk, chunkBox) => {
          // Same precise-frustum filter as the current-time path: AABB
          // iteration is necessary for spatial bounding, but only chunks
          // actually inside the perspective frustum get prefetched.
          if (!frustum.intersectsWithBox3(chunkBox)) return;
          const orderKey = t - currentTimeIndex; // nearer future timepoints first
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

  // World-space extent of the chunk at index `sliceIdx` on `axis`, current
  // LOD. Pairs with `ChunkStore.sliceChunkIndex` to derive the slab
  // integer-first (no float-precision risk at chunk boundaries).
  private sliceSlabBounds(
    axis: "x" | "y" | "z",
    sliceIdx: number
  ): [number, number] {
    const dim = this.store_.dimensions[axis];
    if (dim === undefined) return [-Infinity, Infinity];
    const lod = dim.lods[this.currentLOD_];
    const stride = lod.chunkSize * lod.scale;
    return [
      lod.translation + sliceIdx * stride,
      lod.translation + (sliceIdx + 1) * stride,
    ];
  }

  private cameraFrustumWorldAabb(camera: Camera): Box3 {
    const aabb = new Box3();
    const ndc = vec3.create();
    for (let i = 0; i < 8; ++i) {
      ndc[0] = i & 1 ? 1 : -1;
      ndc[1] = i & 2 ? 1 : -1;
      ndc[2] = i & 4 ? 1 : -1;
      aabb.expandWithPoint(camera.clipToWorld(ndc));
    }
    return aabb;
  }

  private hasViewProjectionChanged(viewProjection: mat4) {
    return (
      this.lastViewProjection_ === null ||
      !mat4.equals(this.lastViewProjection_, viewProjection)
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
    const chunkCenter = {
      x: chunk.offset.x + 0.5 * chunk.shape.x * chunk.scale.x,
      y: chunk.offset.y + 0.5 * chunk.shape.y * chunk.scale.y,
    };
    const dx = chunkCenter.x - center[0];
    const dy = chunkCenter.y - center[1];
    return dx * dx + dy * dy;
  }
}

function resetChunkViewState(state: ChunkViewState): void {
  state.visible = false;
  state.prefetch = false;
  state.priority = null;
  state.orderKey = null;
}
