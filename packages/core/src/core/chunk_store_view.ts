import { Chunk, SliceCoordinates, ChunkViewState } from "../data/chunk";
import type { ChunkStore } from "./chunk_store";
import { Viewport } from "./viewport";
import { OrthographicCamera } from "../objects/cameras/orthographic_camera";
import { ImageSourcePolicy } from "./image_source_policy";
import { ReadonlyVec2, vec2, vec3, mat4 } from "gl-matrix";
import { Box2 } from "../math/box2";
import { Box3 } from "../math/box3";
import type { Frustum } from "../math/frustum";
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
  private lastViewBounds2D_: Box2 | null = null;
  private lastViewProjection_: mat4 | null = null;
  private lastZBounds_?: [number, number];
  private lastTCoord_?: number;
  private lastCCoords_?: number[];

  private sourceMaxSquareDistance2D_: number;
  private maxSquareDistance3D_: number | null = null;
  private readonly chunkViewStates_: Map<Chunk, ChunkViewState> = new Map();
  private readonly chunkBoundsCache_ = new Map<
    Chunk,
    { bounds: Box3; center: vec3 }
  >();
  // This frustum cache can be simplified if we can assume that
  // chunks at the same xyz indices at a given LOD across time
  // all share the same bounds (can remove the bounds here and bounds check)
  private readonly frustumCheckCache_ = new Map<
    string,
    { bounds: Box3; inFrustum: boolean }
  >();

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

  // forwarding methods for chunk stats overlay while keeping store_ private
  public getChunksAtTime(timeIndex: number): Chunk[] {
    return this.store_.getChunksAtTime(timeIndex);
  }

  public getTimeIndex(sliceCoords: SliceCoordinates): number {
    return this.store_.getTimeIndex(sliceCoords);
  }

  public get lodCount(): number {
    return this.store_.lodCount;
  }

  public get channelCount(): number {
    return this.store_.channelCount;
  }

  public getChunksToRender(sliceCoords: SliceCoordinates): Chunk[] {
    const currentTimeIndex = this.store_.getTimeIndex(sliceCoords);
    const currentTimeChunks = this.store_.getChunksAtTime(currentTimeIndex);
    const currentLODChunks = currentTimeChunks.filter(
      (chunk) =>
        chunk.lod === this.currentLOD_ &&
        this.chunkViewStates_.get(chunk)?.visible === true &&
        chunk.state === "loaded"
    );

    const fallbackLOD = this.fallbackLOD();
    if (this.currentLOD_ === fallbackLOD) {
      return currentLODChunks;
    }

    const lowResChunks = currentTimeChunks.filter(
      (chunk) =>
        chunk.lod === fallbackLOD &&
        this.chunkViewStates_.get(chunk)?.visible === true &&
        chunk.state === "loaded"
    );

    return [...currentLODChunks, ...lowResChunks];
  }

  public updateChunksForImage(
    sliceCoords: SliceCoordinates,
    viewport: Viewport
  ): void {
    const camera = viewport.camera;
    if (camera.type !== "OrthographicCamera") {
      throw new Error(
        "ChunkStoreView currently supports only orthographic cameras. " +
          "Update the implementation before using a perspective camera."
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

    const zBounds = this.getZBounds(sliceCoords);
    const changed =
      this.policyChanged_ ||
      this.viewBounds2DChanged(viewBounds2D) ||
      this.zBoundsChanged(zBounds) ||
      this.lastTCoord_ !== sliceCoords.t ||
      this.cCoordsChanged(sliceCoords.c);

    if (!changed) return;

    const currentTimeIndex = this.store_.getTimeIndex(sliceCoords);
    const currentTimeChunks = this.store_.getChunksAtTime(currentTimeIndex);

    if (currentTimeChunks.length === 0) {
      Logger.warn(
        "ChunkStoreView",
        "updateChunkViewStates called with no chunks initialized"
      );
      this.chunkViewStates_.clear();
      return;
    }

    const viewBoundsCenter2D = vec2.create();
    vec2.lerp(viewBoundsCenter2D, viewBounds2D.min, viewBounds2D.max, 0.5);

    const [zMin, zMax] = this.getZBounds(sliceCoords);
    const viewBounds3D = new Box3(
      vec3.fromValues(viewBounds2D.min[0], viewBounds2D.min[1], zMin),
      vec3.fromValues(viewBounds2D.max[0], viewBounds2D.max[1], zMax)
    );

    // reset all existing chunk view states to "not needed" to start
    // logic below will override this for chunks that are actually visible/prefetch
    this.chunkViewStates_.forEach(resetChunkViewState);

    this.updateChunksAtTimeIndex(
      currentTimeIndex,
      sliceCoords,
      viewBounds3D,
      viewBoundsCenter2D
    );

    if (sliceCoords.t !== undefined) {
      this.markTimeChunksForPrefetchImage(
        currentTimeIndex,
        sliceCoords,
        viewBounds3D,
        viewBoundsCenter2D
      );
    }

    this.policyChanged_ = false;
    this.lastViewBounds2D_ = viewBounds2D.clone();
    this.lastZBounds_ = zBounds;
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

    const currentTimeIndex = this.store_.getTimeIndex(sliceCoords);
    const currentTimeChunks = this.store_.getChunksAtTime(currentTimeIndex);

    if (currentTimeChunks.length === 0) {
      Logger.warn(
        "ChunkStoreView",
        "updateChunksForVolume called with no chunks initialized"
      );
      this.chunkViewStates_.clear();
      return;
    }

    // TODO: Calculate LOD dynamically based on view frustum for volume rendering
    // (similar to zoom-based LOD calculation in updateChunksForImage).
    // Currently uses a fixed LOD from policy.
    this.currentLOD_ = this.policy_.lod.min;

    this.chunkViewStates_.forEach(resetChunkViewState);

    const fallbackLOD = this.fallbackLOD();
    const cameraFrustum = viewport.camera.frustum;
    const cameraPosition = viewport.camera.position;
    this.maxSquareDistance3D_ = null;

    for (const chunk of currentTimeChunks) {
      const isCurrentLOD = chunk.lod === this.currentLOD_;
      const isFallbackLOD = chunk.lod === fallbackLOD;
      if (!isCurrentLOD && !isFallbackLOD) continue;

      // Check channel first to avoid more expensive frustum intersection test
      if (!this.isChunkChannelInSlice(chunk, sliceCoords)) continue;

      const { bounds: chunkBounds, center: chunkCenter } =
        this.getCachedChunkBoundsInfo(chunk);
      const inFrustum = cameraFrustum.intersectsWithBox3(chunkBounds);

      // If t-prefetch is enabled, cache frustum check results to avoid redundant
      // checks for subsequent time points with the same spatial bounds
      if (sliceCoords.t !== undefined) {
        const spatialKey = this.getSpatialKey(chunk);
        this.frustumCheckCache_.set(spatialKey, {
          bounds: chunkBounds,
          inFrustum,
        });
      }

      if (!inFrustum) {
        continue;
      }
      const priority = this.computePriority(
        isFallbackLOD,
        isCurrentLOD,
        true, // isVisible
        false, // isPrefetch
        true // isChannelInSlice
      );
      if (priority === null) continue;

      const orderKey = vec3.squaredDistance(chunkCenter, cameraPosition);
      this.maxSquareDistance3D_ = Math.max(
        this.maxSquareDistance3D_ ?? 0,
        orderKey
      );
      this.chunkViewStates_.set(chunk, {
        visible: true,
        prefetch: false,
        priority,
        orderKey,
      });
    }

    if (sliceCoords.t !== undefined) {
      this.markTimeChunksForPrefetchVolume(
        currentTimeIndex,
        sliceCoords,
        cameraFrustum,
        cameraPosition
      );
    }

    this.policyChanged_ = false;
    this.lastTCoord_ = sliceCoords.t;
    this.lastCCoords_ = sliceCoords.c ? [...sliceCoords.c] : undefined;
    this.lastViewProjection_ = viewProjection;
  }

  public allVisibleFallbackLODLoaded(sliceCoords: SliceCoordinates): boolean {
    const timeIndex = this.store_.getTimeIndex(sliceCoords);
    const fallbackLOD = this.fallbackLOD();
    const visibleChunks = this.store_
      .getChunksAtTime(timeIndex)
      .filter((c) => c.visible && c.lod === fallbackLOD);
    // Return false if there are no visible chunks (empty array .every() returns true)
    return (
      visibleChunks.length > 0 &&
      visibleChunks.every((c) => c.state === "loaded")
    );
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
    this.chunkBoundsCache_.clear();
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

  private isChunkChannelInSlice(
    chunk: Chunk,
    sliceCoords: SliceCoordinates
  ): boolean {
    if (sliceCoords.c === undefined) return true;
    if (sliceCoords.c.length === 0) return false;
    return sliceCoords.c.includes(chunk.chunkIndex.c);
  }

  private updateChunksAtTimeIndex(
    timeIndex: number,
    sliceCoords: SliceCoordinates,
    viewBounds3D: Box3,
    viewBounds2DCenter: ReadonlyVec2
  ): void {
    const paddedBounds = this.getPaddedBounds(viewBounds3D);

    const currentTimeChunks = this.store_.getChunksAtTime(timeIndex);
    const fallbackLOD = this.fallbackLOD();

    for (const chunk of currentTimeChunks) {
      const isCurrentLOD = chunk.lod === this.currentLOD_;
      const isFallbackLOD = chunk.lod === fallbackLOD;
      if (!isCurrentLOD && !isFallbackLOD) continue;

      const isChannelInSlice = this.isChunkChannelInSlice(chunk, sliceCoords);
      if (!isChannelInSlice) continue;

      const isInBounds = this.isChunkWithinBounds(chunk, viewBounds3D);

      const prefetch =
        !isInBounds &&
        isChannelInSlice &&
        isCurrentLOD &&
        this.isChunkWithinBounds(chunk, paddedBounds);

      const visible = isInBounds && isChannelInSlice;
      const priority = this.computePriority(
        isFallbackLOD,
        isCurrentLOD,
        isInBounds,
        prefetch,
        isChannelInSlice
      );

      if (priority !== null) {
        const orderKey = this.squareDistance2D(chunk, viewBounds2DCenter);

        this.chunkViewStates_.set(chunk, {
          visible,
          prefetch,
          priority,
          orderKey,
        });
      }
    }
  }

  private markTimeChunksForPrefetchImage(
    currentTimeIndex: number,
    sliceCoords: SliceCoordinates,
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
      for (const chunk of this.store_.getChunksAtTime(t)) {
        if (chunk.lod !== fallbackLOD) continue;
        if (!this.isChunkChannelInSlice(chunk, sliceCoords)) continue;
        if (!this.isChunkWithinBounds(chunk, viewBounds3D)) continue;

        const squareDistance = this.squareDistance2D(chunk, viewBoundsCenter2D);
        const normalizedDistance = clamp(
          squareDistance / this.sourceMaxSquareDistance2D_,
          0,
          1 - Number.EPSILON
        );
        const orderKey = t - currentTimeIndex + normalizedDistance;

        // Always set priority/orderKey to keep loaded chunks alive
        // Only unloaded chunks will be queued for loading
        this.chunkViewStates_.set(chunk, {
          visible: false,
          prefetch: true,
          priority,
          orderKey,
        });
      }
    }
  }

  private markTimeChunksForPrefetchVolume(
    currentTimeIndex: number,
    sliceCoords: SliceCoordinates,
    frustum: Frustum,
    cameraPosition: vec3
  ) {
    const numTimePoints = this.store_.dimensions.t?.lods[0].size ?? 1;
    const tEnd = Math.min(
      numTimePoints - 1,
      currentTimeIndex + this.policy_.prefetch.t
    );
    const fallbackLOD = this.fallbackLOD();
    const priority = this.policy_.priorityMap["prefetchTime"];

    let maxDistance = 0;
    for (let t = currentTimeIndex + 1; t <= tEnd; ++t) {
      for (const chunk of this.store_.getChunksAtTime(t)) {
        if (chunk.lod !== fallbackLOD) continue;
        if (!this.isChunkChannelInSlice(chunk, sliceCoords)) continue;

        const { bounds: chunkBounds, center: chunkCenter } =
          this.getCachedChunkBoundsInfo(chunk);

        const spatialKey = this.getSpatialKey(chunk);
        const cached = this.frustumCheckCache_.get(spatialKey);
        // This check can be removed if we can guarantee that all chunks at the same
        // xyz indices and LOD across time share the same bounds
        if (cached && this.boundsEqual(cached.bounds, chunkBounds)) {
          if (!cached.inFrustum) continue;
        } else {
          if (!frustum.intersectsWithBox3(chunkBounds)) continue;
        }

        const squareDistance = vec3.squaredDistance(
          chunkCenter,
          cameraPosition
        );
        const normalizedDistance = clamp(
          squareDistance / (this.maxSquareDistance3D_ ?? 1),
          0,
          1 - Number.EPSILON
        );
        maxDistance = Math.max(maxDistance, squareDistance);
        // first order by time distance, then by spatial distance
        const orderKey = t - currentTimeIndex + normalizedDistance;

        this.chunkViewStates_.set(chunk, {
          visible: false,
          prefetch: true,
          priority,
          orderKey,
        });
      }
    }
    this.maxSquareDistance3D_ =
      maxDistance > 0 ? maxDistance : this.maxSquareDistance3D_;
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

  private getCachedChunkBoundsInfo(chunk: Chunk): {
    bounds: Box3;
    center: vec3;
  } {
    const cached = this.chunkBoundsCache_.get(chunk);
    if (cached) return cached;

    const bounds = new Box3(
      vec3.fromValues(chunk.offset.x, chunk.offset.y, chunk.offset.z),
      vec3.fromValues(
        chunk.offset.x + chunk.shape.x * chunk.scale.x,
        chunk.offset.y + chunk.shape.y * chunk.scale.y,
        chunk.offset.z + chunk.shape.z * chunk.scale.z
      )
    );
    const boundsInfo = {
      bounds,
      center: vec3.fromValues(
        (bounds.min[0] + bounds.max[0]) * 0.5,
        (bounds.min[1] + bounds.max[1]) * 0.5,
        (bounds.min[2] + bounds.max[2]) * 0.5
      ),
    };
    this.chunkBoundsCache_.set(chunk, boundsInfo);
    return boundsInfo;
  }

  private isChunkWithinBounds(chunk: Chunk, bounds: Box3): boolean {
    return Box3.intersects(this.getCachedChunkBoundsInfo(chunk).bounds, bounds);
  }

  private getSpatialKey(chunk: Chunk): string {
    const { x, y, z } = chunk.chunkIndex;
    return `${x}:${y}:${z}:lod${chunk.lod}`;
  }

  private boundsEqual(a: Box3, b: Box3): boolean {
    return (
      a.min[0] === b.min[0] &&
      a.min[1] === b.min[1] &&
      a.min[2] === b.min[2] &&
      a.max[0] === b.max[0] &&
      a.max[1] === b.max[1] &&
      a.max[2] === b.max[2]
    );
  }

  private fallbackLOD(): number {
    return Math.min(this.policy_.lod.max, this.store_.getLowestResLOD());
  }

  private getZBounds(sliceCoords: SliceCoordinates): [number, number] {
    const zDim = this.store_.dimensions.z;
    if (zDim === undefined) return [0, 1];

    // If z is undefined, return bounds that encompass all z slices (for volume rendering)
    if (sliceCoords.z === undefined) {
      const zLod = zDim.lods[this.currentLOD_];
      return [zLod.translation, zLod.translation + zLod.size * zLod.scale];
    }

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

  private hasViewProjectionChanged(viewProjection: mat4) {
    return (
      this.lastViewProjection_ === null ||
      !mat4.equals(this.lastViewProjection_, viewProjection)
    );
  }

  private zBoundsChanged(newBounds: [number, number]): boolean {
    return !this.lastZBounds_ || !vec2.equals(this.lastZBounds_, newBounds);
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
