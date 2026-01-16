import { Chunk, ChunkViewState } from "../data/chunk";
import {
  SliceCoordinates,
  getSlicePosition,
  chunkIntersectsSlice,
  getHorizontalDimension,
  getSlicedDimension,
  isAxisAlignedSlice,
  getSlicePlane,
  projectPointOntoPlane,
} from "../data/slice_coordinates";
import { ChunkStore } from "./chunk_store";
import { Viewport } from "./viewport";
import type { Camera } from "../objects/cameras/camera";
import { OrthographicCamera } from "../objects/cameras/orthographic_camera";
import { ImageSourcePolicy } from "./image_source_policy";
import { vec2, vec3, mat4 } from "gl-matrix";
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
  private lastViewProjectionMatrix_?: mat4;
  private lastSliceBounds_?: [number, number];
  private lastTCoord_?: number;

  private sourceMaxSquareDistance3D_: number;
  private readonly chunkViewStates_: Map<Chunk, ChunkViewState> = new Map();

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
    const zLod0 = dimensions.z?.lods[0];

    // Calculate max 3D distance (diagonal of the dataset bounding box)
    const maxExtent = vec3.fromValues(
      xLod0.size * xLod0.scale,
      yLod0.size * yLod0.scale,
      zLod0 ? zLod0.size * zLod0.scale : 0
    );
    this.sourceMaxSquareDistance3D_ = vec3.squaredLength(maxExtent);
  }

  public get chunkViewStates(): ReadonlyMap<Chunk, ChunkViewState> {
    return this.chunkViewStates_;
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

    // If we're at the lowest resolution LOD, only return current LOD chunks
    const lowestResLOD = this.store_.getLowestResLOD();
    if (this.currentLOD_ === lowestResLOD) {
      return currentLODChunks;
    }

    const lowResChunks = currentTimeChunks.filter(
      (chunk) =>
        chunk.lod === lowestResLOD &&
        this.chunkViewStates_.get(chunk)?.visible === true &&
        chunk.state === "loaded"
    );

    return [...currentLODChunks, ...lowResChunks];
  }

  // TODO: Eventually unify visibility calculations using the camera frustum for both
  // orthographic (2D slices) and perspective (volume rendering) cameras. This would
  // replace both updateChunkStates and updateChunkStatesForVolume with a single method
  // that performs frustum culling based on the camera type.
  public updateChunkStatesForVolume(sliceCoords: SliceCoordinates): void {
    const currentTimeIndex = this.store_.getTimeIndex(sliceCoords);
    const currentTimeChunks = this.store_.getChunksAtTime(currentTimeIndex);

    if (currentTimeChunks.length === 0) {
      Logger.warn(
        "ChunkStoreView",
        "updateChunkStatesForVolume called with no chunks initialized"
      );
      this.chunkViewStates_.clear();
      return;
    }

    // TODO: allow volume rendering to calculate an LOD factor
    this.setLOD(0);
    this.chunkViewStates_.forEach(resetChunkViewState);

    for (const chunk of currentTimeChunks) {
      if (chunk.lod !== this.currentLOD_) continue;

      const isChannelMatch =
        sliceCoords.c === undefined || sliceCoords.c === chunk.chunkIndex.c;
      if (!isChannelMatch) continue;

      const priority = this.policy_.priorityMap["visibleCurrent"];
      this.chunkViewStates_.set(chunk, {
        visible: true,
        prefetch: false,
        priority,
        orderKey: 0, // All chunks have the same ordering for volume rendering
      });
    }

    this.lastTCoord_ = sliceCoords.t;
  }

  public updateChunkStates(
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

    // Calculate LOD based on frustum width (accounts for camera zoom)
    const frustum = camera.frustum;
    const virtualWidth = frustum.getWidth();

    const canvasElement = viewport.element as HTMLCanvasElement;
    const bufferWidth = viewport.getBoxRelativeTo(canvasElement).toRect().width;
    const virtualUnitsPerScreenPixel = virtualWidth / bufferWidth;
    const lodFactor = Math.log2(1 / virtualUnitsPerScreenPixel);

    this.setLOD(lodFactor, sliceCoords);

    // Get view-projection matrix for change detection
    const viewProjectionMatrix = mat4.multiply(
      mat4.create(),
      camera.projectionMatrix,
      camera.viewMatrix
    );

    const sliceBounds = this.getSliceBounds(sliceCoords);
    const changed =
      this.policyChanged_ ||
      this.viewProjectionMatrixChanged(viewProjectionMatrix) ||
      this.sliceBoundsChanged(sliceBounds) ||
      this.lastTCoord_ !== sliceCoords.t;

    if (changed) {
      this.updateChunkViewStates(sliceCoords, viewport);

      this.policyChanged_ = false;
      this.lastViewProjectionMatrix_ = mat4.clone(viewProjectionMatrix);
      this.lastSliceBounds_ = sliceBounds;
      this.lastTCoord_ = sliceCoords.t;
    }
  }

  public allVisibleLowestLODLoaded(sliceCoords: SliceCoordinates): boolean {
    const timeIndex = this.store_.getTimeIndex(sliceCoords);
    const visibleChunks = this.store_
      .getChunksAtTime(timeIndex)
      .filter((c) => c.visible && c.lod === this.store_.getLowestResLOD());
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
    this.store_.removeView(this);
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

  private setLOD(lodFactor: number, sliceCoords: SliceCoordinates): void {
    // Get the horizontal dimension scale based on orientation
    // For orthographic camera, we use the horizontal (X) screen dimension
    const dimensions = this.store_.dimensions;

    const scale0 = isAxisAlignedSlice(sliceCoords)
      ? getHorizontalDimension(dimensions, sliceCoords.orientation).lods[0]
          .scale
      : dimensions.x.lods[0].scale;

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

  private updateChunkViewStates(
    sliceCoords: SliceCoordinates,
    viewport: Viewport
  ): void {
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

    // Create frustums once and reuse
    const frustum = viewport.camera.frustum;
    const prefetchFrustum = this.getExpandedFrustum(viewport.camera);

    // Project camera position onto slice plane for distance calculations
    // For slices, we want to prioritize chunks near where we're looking on the slice
    // For volumes, we use the camera position directly
    const cameraPosition = viewport.camera.position;
    const slicePlane = getSlicePlane(sliceCoords);
    const referencePoint = slicePlane
      ? projectPointOntoPlane(cameraPosition, slicePlane)
      : cameraPosition;

    // reset all existing chunk view states to "not needed" to start
    // logic below will override this for chunks that are actually visible/prefetch
    this.chunkViewStates_.forEach(resetChunkViewState);

    this.updateChunksAtTimeIndex(
      currentTimeIndex,
      sliceCoords,
      frustum,
      prefetchFrustum,
      referencePoint
    );

    if (sliceCoords.t !== undefined) {
      this.markTimeChunksForPrefetch(
        currentTimeIndex,
        sliceCoords,
        frustum,
        referencePoint
      );
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
    frustum: Frustum,
    prefetchFrustum: Frustum,
    referencePoint: vec3
  ): void {
    const currentTimeChunks = this.store_.getChunksAtTime(timeIndex);

    for (const chunk of currentTimeChunks) {
      const isVisible = this.isChunkVisibleInSlice(chunk, sliceCoords, frustum);
      const isChannelInSlice = this.isChunkChannelInSlice(chunk, sliceCoords);

      const isCurrentLOD = chunk.lod === this.currentLOD_;
      const isFallbackLOD = chunk.lod === this.store_.getLowestResLOD();

      const prefetch =
        !isVisible &&
        isChannelInSlice &&
        isCurrentLOD &&
        this.isChunkVisibleInSlice(chunk, sliceCoords, prefetchFrustum);

      const visible = isVisible && isChannelInSlice;
      const priority = this.computePriority(
        isFallbackLOD,
        isCurrentLOD,
        isVisible,
        prefetch,
        isChannelInSlice
      );

      if (priority !== null) {
        const orderKey = this.squareDistance3D(chunk, referencePoint);

        this.chunkViewStates_.set(chunk, {
          visible,
          prefetch,
          priority,
          orderKey,
        });
      }
    }
  }

  private markTimeChunksForPrefetch(
    currentTimeIndex: number,
    sliceCoords: SliceCoordinates,
    frustum: Frustum,
    referencePoint: vec3
  ): void {
    const numTimePoints = this.store_.dimensions.t?.lods[0].size ?? 1;
    const tEnd = Math.min(
      numTimePoints - 1,
      currentTimeIndex + this.policy_.prefetch.t
    );
    for (let t = currentTimeIndex + 1; t <= tEnd; ++t) {
      for (const chunk of this.store_.getChunksAtTime(t)) {
        if (chunk.lod !== this.store_.getLowestResLOD()) continue;
        if (!this.isChunkVisibleInSlice(chunk, sliceCoords, frustum)) continue;

        const priority = this.policy_.priorityMap["prefetchTime"];
        const squareDistance = this.squareDistance3D(chunk, referencePoint);
        const normalizedDistance = clamp(
          squareDistance / this.sourceMaxSquareDistance3D_,
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

  private isChunkVisibleInSlice(
    chunk: Chunk,
    sliceCoords: SliceCoordinates,
    frustum: Frustum
  ): boolean {
    const slicePosition = getSlicePosition(sliceCoords);

    // Create the chunk's 3D bounding box
    const chunkBounds = new Box3(
      vec3.fromValues(chunk.offset.x, chunk.offset.y, chunk.offset.z),
      vec3.fromValues(
        chunk.offset.x + chunk.shape.x * chunk.scale.x,
        chunk.offset.y + chunk.shape.y * chunk.scale.y,
        chunk.offset.z + chunk.shape.z * chunk.scale.z
      )
    );

    // Check if chunk is in camera frustum
    if (!frustum.intersectsWithBox3(chunkBounds)) {
      return false;
    }

    // Check if chunk intersects with the slice plane
    if (slicePosition === undefined) {
      // No slicing for volume rendering or oblique slices
      return !isAxisAlignedSlice(sliceCoords);
    }

    if (!isAxisAlignedSlice(sliceCoords)) {
      return true;
    }

    return chunkIntersectsSlice(chunk, sliceCoords.orientation, slicePosition);
  }

  private getSliceBounds(sliceCoords: SliceCoordinates): [number, number] {
    const slicePosition = getSlicePosition(sliceCoords);

    if (!isAxisAlignedSlice(sliceCoords) || slicePosition === undefined) {
      return [0, 1];
    }

    const dim = getSlicedDimension(
      this.store_.dimensions,
      sliceCoords.orientation
    );
    if (dim === undefined) {
      return [0, 1];
    }

    const lod = dim.lods[this.currentLOD_];
    const shape = lod.size;
    const scale = lod.scale;
    const translation = lod.translation;
    const point = Math.floor((slicePosition - translation) / scale);
    const chunkSize = lod.chunkSize;

    const chunkIndex = Math.max(
      0,
      Math.min(Math.floor(point / chunkSize), Math.ceil(shape / chunkSize) - 1)
    );

    return [
      translation + chunkIndex * chunkSize * scale,
      translation + (chunkIndex + 1) * chunkSize * scale,
    ];
  }

  private viewProjectionMatrixChanged(newMatrix: mat4): boolean {
    return (
      !this.lastViewProjectionMatrix_ ||
      !mat4.equals(this.lastViewProjectionMatrix_, newMatrix)
    );
  }

  private sliceBoundsChanged(newBounds: [number, number]): boolean {
    return (
      !this.lastSliceBounds_ || !vec2.equals(this.lastSliceBounds_, newBounds)
    );
  }

  private getExpandedFrustum(camera: Camera): Frustum {
    // Only support orthographic cameras for now
    if (camera.type !== "OrthographicCamera") {
      return camera.frustum;
    }

    const orthoCamera = camera as OrthographicCamera;

    // Calculate padding based on prefetch policy and chunk dimensions
    const dimensions = this.store_.dimensions;
    const xLod = dimensions.x.lods[this.currentLOD_];
    const yLod = dimensions.y.lods[this.currentLOD_];

    const padX = xLod.chunkSize * xLod.scale * this.policy_.prefetch.x;
    const padY = yLod.chunkSize * yLod.scale * this.policy_.prefetch.y;

    // Get current viewport size from camera
    const halfWidth = orthoCamera.viewportSize[0] / 2;
    const halfHeight = orthoCamera.viewportSize[1] / 2;

    // Camera position gives us the center point
    const cameraPos = orthoCamera.position;

    // Compute world bounds and expand by padding
    const expandedLeft = cameraPos[0] - halfWidth - padX;
    const expandedRight = cameraPos[0] + halfWidth + padX;
    const expandedBottom = cameraPos[1] - halfHeight - padY;
    const expandedTop = cameraPos[1] + halfHeight + padY;

    // Create expanded projection matrix
    // Use a large near/far range since we're doing 2D slicing
    // The slice plane intersection check handles Z bounds
    const expandedProjection = mat4.create();
    const near = -10000;
    const far = 10000;
    mat4.ortho(
      expandedProjection,
      expandedLeft,
      expandedRight,
      expandedBottom,
      expandedTop,
      near,
      far
    );

    // Combine with view matrix to get view-projection
    const viewProjection = mat4.multiply(
      mat4.create(),
      expandedProjection,
      orthoCamera.viewMatrix
    );

    return new Frustum(viewProjection);
  }

  private squareDistance3D(chunk: Chunk, center: vec3): number {
    const chunkCenter = vec3.fromValues(
      chunk.offset.x + 0.5 * chunk.shape.x * chunk.scale.x,
      chunk.offset.y + 0.5 * chunk.shape.y * chunk.scale.y,
      chunk.offset.z + 0.5 * chunk.shape.z * chunk.scale.z
    );
    return vec3.squaredDistance(chunkCenter, center);
  }
}

function resetChunkViewState(state: ChunkViewState): void {
  state.visible = false;
  state.prefetch = false;
  state.priority = null;
  state.orderKey = null;
}
