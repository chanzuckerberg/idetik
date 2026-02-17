import { Chunk, SliceCoordinates, ChunkViewState } from "../data/chunk";
import type { ChunkStore } from "./chunk_store";
import { Viewport } from "./viewport";
import { OrthographicCamera } from "../objects/cameras/orthographic_camera";
import { ImageSourcePolicy } from "./image_source_policy";
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
  private lastViewBounds2D_: Box2 | null = null;
  private lastViewProjection_: mat4 | null = null;
  private lastZBounds_?: [number, number];
  private lastTCoord_?: number;

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
      this.lastTCoord_ !== sliceCoords.t;

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
      this.lastTCoord_ !== sliceCoords.t;

    if (!changed) return;

    const currentTimeIndex = this.store_.getTimeIndex(sliceCoords);
    const currentTimeChunks = this.store_.getChunksAtTime(currentTimeIndex);

    if (currentTimeChunks === undefined) {
      Logger.warn(
        "ChunkStoreView",
        `No chunks found for time index ${currentTimeIndex}. Check if the store is initialized and the time coordinate is correct.`
      );
      this.chunkViewStates_.clear();
      return;
    }

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

    for (const chunk of currentTimeChunks) {
      if (chunk.lod !== this.currentLOD_) continue;
      if (!this.isChunkChannelInSlice(chunk, sliceCoords)) continue;

      const isFallbackLOD = chunk.lod === fallbackLOD;
      const priority = this.computePriority(
        isFallbackLOD,
        true, // isCurrentLOD
        true, // isVisible
        false, // isPrefetch
        true // isChannelInSlice
      );

      this.chunkViewStates_.set(chunk, {
        visible: true,
        prefetch: false,
        priority,
        orderKey: 0, // All chunks have the same ordering for volume rendering
      });
    }

    if (sliceCoords.t !== undefined) {
      this.markTimeChunksForPrefetchVolume(currentTimeIndex, sliceCoords);
    }

    this.policyChanged_ = false;
    this.lastTCoord_ = sliceCoords.t;
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
    return sliceCoords.c === undefined || sliceCoords.c === chunk.chunkIndex.c;
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
      const isInBounds = this.isChunkWithinBounds(chunk, viewBounds3D);
      const isChannelInSlice = this.isChunkChannelInSlice(chunk, sliceCoords);

      const isCurrentLOD = chunk.lod === this.currentLOD_;
      const isFallbackLOD = chunk.lod === fallbackLOD;

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
    sliceCoords: SliceCoordinates
  ) {
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

        const orderKey = t - currentTimeIndex; // nearer future timepoints first

        this.chunkViewStates_.set(chunk, {
          visible: false,
          prefetch: true,
          priority,
          orderKey,
        });
      }
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
