import { Chunk, SliceCoordinates, ChunkViewState, getOrientation, getSlicePosition, SourceDimension } from "../data/chunk";
import { ChunkStore } from "./chunk_store";
import { Viewport } from "./viewport";
import { OrthographicCamera } from "../objects/cameras/orthographic_camera";
import { ImageSourcePolicy } from "./image_source_policy";
import { ReadonlyVec2, vec2, vec3 } from "gl-matrix";
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

const PRI_FALLBACK_BACKGROUND = 4;

export class ChunkStoreView {
  private readonly store_: ChunkStore;
  private policy_: ImageSourcePolicy;
  private policyChanged_ = false;
  private currentLOD_: number = 0;
  private lastViewBounds2D_: Box2 | null = null;
  private lastSliceBounds_?: [number, number];
  private lastTCoord_?: number;

  private sourceMaxSquareDistance2D_: number;
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
    this.sourceMaxSquareDistance2D_ = vec2.squaredLength(
      vec2.fromValues(xLod0.size * xLod0.scale, yLod0.size * yLod0.scale)
    );
  }

  public get store(): ChunkStore {
    return this.store_;
  }

  public get chunkViewStates(): ReadonlyMap<Chunk, ChunkViewState> {
    return this.chunkViewStates_;
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

    return [...lowResChunks, ...currentLODChunks];
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

    const orthoCamera = camera as OrthographicCamera;
    const viewBounds2D = orthoCamera.getWorldViewRect();

    // For YZ orientation with rotated camera, axes are swapped in viewBounds2D
    // viewBounds2D[0] = Z, viewBounds2D[1] = Y
    // We need the Y range (horizontal) for LOD calculation
    const orientation = getOrientation(sliceCoords);
    const virtualWidth =
      orientation === "yz"
        ? Math.abs(viewBounds2D.max[1] - viewBounds2D.min[1]) // Use Y (index 1)
        : Math.abs(viewBounds2D.max[0] - viewBounds2D.min[0]); // Use X (index 0)

    const canvasElement = viewport.element as HTMLCanvasElement;
    const bufferWidth = viewport.getBoxRelativeTo(canvasElement).toRect().width;
    const virtualUnitsPerScreenPixel = virtualWidth / bufferWidth;
    const lodFactor = Math.log2(1 / virtualUnitsPerScreenPixel);

    this.setLOD(lodFactor, sliceCoords);

    const sliceBounds = this.getSliceBounds(sliceCoords);
    const changed =
      this.policyChanged_ ||
      this.viewBounds2DChanged(viewBounds2D) ||
      this.sliceBoundsChanged(sliceBounds) ||
      this.lastTCoord_ !== sliceCoords.t;

    if (changed) {
      this.updateChunkViewStates(sliceCoords, viewBounds2D, viewport);

      this.policyChanged_ = false;
      this.lastViewBounds2D_ = viewBounds2D.clone();
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
    const orientation = getOrientation(sliceCoords);

    // Determine which dimension corresponds to horizontal screen space
    let scale0: number;
    switch (orientation) {
      case "xy":
        scale0 = dimensions.x.lods[0].scale;
        break;
      case "xz":
        scale0 = dimensions.x.lods[0].scale;
        break;
      case "yz":
        // For YZ orientation, Y is horizontal (after rotation)
        scale0 = dimensions.y.lods[0].scale;
        break;
      case "volume":
        scale0 = dimensions.x.lods[0].scale;
        break;
    }

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
    viewBounds2D: Box2,
    _viewport: Viewport
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

    const viewBoundsCenter2D = vec2.create();
    vec2.lerp(viewBoundsCenter2D, viewBounds2D.min, viewBounds2D.max, 0.5);

    const [sliceMin, sliceMax] = this.getSliceBounds(sliceCoords);
    const orientation = getOrientation(sliceCoords);

    // Construct 3D bounds based on orientation
    let viewBounds3D: Box3;
    switch (orientation) {
      case "xy":
        // XY plane: 2D viewport shows X and Y, slice along Z
        viewBounds3D = new Box3(
          vec3.fromValues(viewBounds2D.min[0], viewBounds2D.min[1], sliceMin),
          vec3.fromValues(viewBounds2D.max[0], viewBounds2D.max[1], sliceMax)
        );
        break;
      case "xz":
        // XZ plane: 2D viewport shows X and Z, slice along Y
        viewBounds3D = new Box3(
          vec3.fromValues(viewBounds2D.min[0], sliceMin, viewBounds2D.min[1]),
          vec3.fromValues(viewBounds2D.max[0], sliceMax, viewBounds2D.max[1])
        );
        break;
      case "yz": {
        // YZ plane: 2D viewport shows Y (horizontal) and Z (vertical), slice along X
        // After camera rotation, getWorldViewRect returns [constant, Y_range]
        // We need to get Z range from the data dimensions
        const dimensions = this.store_.dimensions;
        const zDim = dimensions.z;
        const zMin = zDim ? zDim.lods[0].translation : 0;
        const zMax = zDim
          ? zDim.lods[0].translation + zDim.lods[0].scale * (zDim.lods[0].size - 1)
          : 0;
        viewBounds3D = new Box3(
          vec3.fromValues(sliceMin, viewBounds2D.min[1], zMin),
          vec3.fromValues(sliceMax, viewBounds2D.max[1], zMax)
        );
        Logger.debug(
          "ChunkStoreView",
          `YZ viewBounds: 2D=[${viewBounds2D.min[0].toFixed(1)},${viewBounds2D.min[1].toFixed(1)}]-[${viewBounds2D.max[0].toFixed(1)},${viewBounds2D.max[1].toFixed(1)}], 3D(XYZ)=[${viewBounds3D.min[0].toFixed(1)},${viewBounds3D.min[1].toFixed(1)},${viewBounds3D.min[2].toFixed(1)}]-[${viewBounds3D.max[0].toFixed(1)},${viewBounds3D.max[1].toFixed(1)},${viewBounds3D.max[2].toFixed(1)}], sliceRange=[${sliceMin.toFixed(1)},${sliceMax.toFixed(1)}]`
        );
        break;
      }
      case "volume":
        // Volume: use full bounds (shouldn't happen in practice)
        viewBounds3D = new Box3(
          vec3.fromValues(viewBounds2D.min[0], viewBounds2D.min[1], sliceMin),
          vec3.fromValues(viewBounds2D.max[0], viewBounds2D.max[1], sliceMax)
        );
        break;
    }

    // reset all existing chunk view states to "not needed" to start
    // logic below will override this for chunks that are actually visible/prefetch
    this.chunkViewStates_.forEach(markUnused);

    this.updateChunksAtTimeIndex(
      currentTimeIndex,
      sliceCoords,
      viewBounds3D,
      viewBoundsCenter2D
    );

    if (sliceCoords.t !== undefined) {
      this.markTimeChunksForPrefetch(
        currentTimeIndex,
        viewBounds3D,
        viewBoundsCenter2D
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
    viewBounds3D: Box3,
    viewBounds2DCenter: ReadonlyVec2
  ): void {
    const paddedBounds = this.getPaddedBounds(viewBounds3D);

    const currentTimeChunks = this.store_.getChunksAtTime(timeIndex);

    for (const chunk of currentTimeChunks) {
      const isVisible = this.isChunkWithinBounds(chunk, viewBounds3D);
      const isChannelInSlice = this.isChunkChannelInSlice(chunk, sliceCoords);
      const eligibleForPrefetch =
        !isVisible &&
        isChannelInSlice &&
        this.isChunkWithinBounds(chunk, paddedBounds);

      const isCurrentLOD = chunk.lod === this.currentLOD_;
      const isFallbackLOD = chunk.lod === this.store_.getLowestResLOD();
      const visible = isVisible && isChannelInSlice;
      const prefetch =
        eligibleForPrefetch && isCurrentLOD && chunk.state !== "loaded";
      const priority = this.computePriority(
        isFallbackLOD,
        isCurrentLOD,
        isVisible,
        prefetch,
        isChannelInSlice
      );

      if (
        visible ||
        prefetch ||
        (priority !== null && priority !== PRI_FALLBACK_BACKGROUND)
      ) {
        const orderKey =
          priority !== null
            ? this.squareDistance2D(chunk, viewBounds2DCenter)
            : null;

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
    viewBounds3D: Box3,
    viewBoundsCenter2D: ReadonlyVec2
  ): void {
    const numTimePoints = this.store_.dimensions.t?.lods[0].size ?? 1;
    const tEnd = Math.min(
      numTimePoints - 1,
      currentTimeIndex + this.policy_.prefetch.t
    );
    for (let t = currentTimeIndex + 1; t <= tEnd; ++t) {
      for (const chunk of this.store_.getChunksAtTime(t)) {
        if (chunk.lod !== this.store_.getLowestResLOD()) continue;
        if (!this.isChunkWithinBounds(chunk, viewBounds3D)) continue;

        const priority = this.policy_.priorityMap["prefetchTime"];
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

  private getSliceBounds(sliceCoords: SliceCoordinates): [number, number] {
    const orientation = getOrientation(sliceCoords);
    const slicePosition = getSlicePosition(sliceCoords);

    // Determine which dimension to slice based on orientation
    let dim: SourceDimension | undefined;
    switch (orientation) {
      case "xy":
        dim = this.store_.dimensions.z;
        break;
      case "xz":
        dim = this.store_.dimensions.y;
        break;
      case "yz":
        dim = this.store_.dimensions.x;
        break;
      case "volume":
        return [0, 1];
    }

    if (dim === undefined || slicePosition === undefined) {
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
      Math.min(
        Math.floor(point / chunkSize),
        Math.ceil(shape / chunkSize) - 1
      )
    );

    return [
      translation + chunkIndex * chunkSize * scale,
      translation + (chunkIndex + 1) * chunkSize * scale,
    ];
  }

  private viewBounds2DChanged(newBounds: Box2): boolean {
    return (
      this.lastViewBounds2D_ === null ||
      !vec2.equals(this.lastViewBounds2D_.min, newBounds.min) ||
      !vec2.equals(this.lastViewBounds2D_.max, newBounds.max)
    );
  }

  private sliceBoundsChanged(newBounds: [number, number]): boolean {
    return !this.lastSliceBounds_ || !vec2.equals(this.lastSliceBounds_, newBounds);
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

function markUnused(state: ChunkViewState): void {
  state.visible = false;
  state.prefetch = false;
  state.priority = null;
  state.orderKey = null;
}
