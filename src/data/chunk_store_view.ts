import {
  Chunk,
  ChunkViewState,
  coordToIndex,
  SliceCoordinates,
  SourceDimension,
  SourceDimensionLod,
} from "./chunk";
import { SliceAxes, SpatialAxis } from "../math/axes";
import type { ChunkStore } from "./chunk_store";
import { ImageSourcePolicy } from "../core/image_source_policy";
import { vec2, mat4 } from "gl-matrix";
import { Box2 } from "../math/box2";
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
  private targetLOD_: number = 0;
  private readonly axes_: SliceAxes;
  private readonly scale0_: number;
  private mode_: "image" | "volume" | null = null;
  private lastViewBounds2D_: Box2 | null = null;
  private lastViewProjection_: mat4 | null = null;
  private lastRegion_: ChunkRegion | null = null;

  private lastSliceCoordW_?: number;
  private lastTCoord_?: number;
  private lastCCoords_?: number[];

  private readonly sourceMaxSquareDistance2D_: number;
  private readonly chunkViewStates_: Map<Chunk, ChunkViewState> = new Map();

  private isDisposed_ = false;

  constructor(
    store: ChunkStore,
    policy: ImageSourcePolicy,
    axes: SliceAxes = { u: "x", v: "y", w: "z" }
  ) {
    this.store_ = store;
    this.policy_ = policy;
    this.axes_ = axes;

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

  public getWholePlaneRect(): Box2 {
    const dimensions = this.store_.dimensions;
    const uLod0 = dimensions[this.axes_.u]!.lods[0];
    const vLod0 = dimensions[this.axes_.v]!.lods[0];

    return new Box2(
      vec2.fromValues(uLod0.translation, vLod0.translation),
      vec2.fromValues(
        uLod0.translation + uLod0.size * uLod0.scale,
        vLod0.translation + vLod0.size * vLod0.scale
      )
    );
  }

  public getChunksToRender(): Chunk[] {
    const drawable =
      this.mode_ === "image"
        ? this.residentChunksForSlice()
        : this.residentChunksMarkedVisible();

    const targetLOD = this.targetLOD_;
    return drawable.sort(
      (a, b) =>
        Math.abs(a.lod - targetLOD) - Math.abs(b.lod - targetLOD) ||
        b.lod - a.lod
    );
  }

  private residentChunksMarkedVisible(): Chunk[] {
    const chunks: Chunk[] = [];
    for (const [chunk, state] of this.chunkViewStates_) {
      if (state.visible && chunk.state === "loaded" && chunk.texture) {
        chunks.push(chunk);
      }
    }
    return chunks;
  }

  private residentChunksForSlice(): Chunk[] {
    const timeIndex = this.timeIndex(this.lastTCoord_);
    const channels = new Set(this.channelsOfInterest(this.lastCCoords_));
    const { min: minLOD, max: maxLOD } = this.lodRange();
    const region = this.lastRegion_;
    if (region === null) return [];

    const chunks: Chunk[] = [];
    for (const chunk of this.store_.residentChunks) {
      if (chunk.lod < minLOD || chunk.lod > maxLOD) continue;
      if (chunk.chunkIndex.t !== timeIndex) continue;
      if (!channels.has(chunk.chunkIndex.c)) continue;
      if (!region.contains(chunk)) continue;
      chunks.push(chunk);
    }
    return chunks;
  }

  public updateChunksForImage(
    sliceCoords: SliceCoordinates,
    view: { worldViewRect: Box2; bufferWidthPx: number }
  ): void {
    const viewBounds2D = view.worldViewRect;
    const virtualWidth = Math.abs(viewBounds2D.max[0] - viewBounds2D.min[0]);
    const virtualUnitsPerScreenPixel = virtualWidth / view.bufferWidthPx;
    const lodFactor = Math.log2(1 / virtualUnitsPerScreenPixel);

    const lodChanged = this.setLOD(lodFactor);

    const changed =
      this.policyChanged_ ||
      lodChanged ||
      this.viewBounds2DChanged(viewBounds2D) ||
      this.lastSliceCoordW_ !== sliceCoords[this.axes_.w] ||
      this.lastTCoord_ !== sliceCoords.t ||
      this.cCoordsChanged(sliceCoords.c);

    if (!changed) return;

    const currentTimeIndex = this.timeIndex(sliceCoords.t);
    if (!this.store_.hasChunksAtTime(currentTimeIndex)) {
      Logger.warn(
        "ChunkStoreView",
        "updateChunkViewStates called with no chunks initialized"
      );
      this.mode_ = null;
      this.chunkViewStates_.forEach(resetChunkViewState);
      return;
    }

    // reset all existing chunk view states to "not needed" to start
    // logic below will override this for chunks that are actually visible/prefetch
    this.chunkViewStates_.forEach(resetChunkViewState);

    const sliceCoordW = sliceCoords[this.axes_.w];
    const currentLOD = this.currentLOD;
    this.markChunks(
      ChunkRegion.forSlice(
        this.store_,
        this.axes_,
        viewBounds2D,
        sliceCoordW,
        currentLOD
      ),
      ChunkRegion.forSlice(
        this.store_,
        this.axes_,
        viewBounds2D,
        sliceCoordW,
        currentLOD,
        this.policy_.prefetch
      ),
      currentTimeIndex,
      this.channelsOfInterest(sliceCoords.c)
    );

    this.policyChanged_ = false;
    this.mode_ = "image";
    this.lastViewBounds2D_ = viewBounds2D.clone();
    this.lastSliceCoordW_ = sliceCoords[this.axes_.w];
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

    const currentTimeIndex = this.timeIndex(sliceCoords.t);
    if (!this.store_.hasChunksAtTime(currentTimeIndex)) {
      Logger.warn(
        "ChunkStoreView",
        "updateChunksForVolume called with no chunks initialized"
      );
      this.mode_ = null;
      this.chunkViewStates_.forEach(resetChunkViewState);
      return;
    }

    // TODO: Calculate LOD dynamically based on view frustum for volume rendering
    // (similar to zoom-based LOD calculation in updateChunksForImage).
    // Currently uses a fixed LOD from policy.
    this.targetLOD_ = this.policy_.lod.min;

    this.chunkViewStates_.forEach(resetChunkViewState);

    const region = ChunkRegion.forVolume(this.store_);
    this.markChunks(
      region,
      region,
      currentTimeIndex,
      this.channelsOfInterest(sliceCoords.c)
    );

    this.policyChanged_ = false;
    this.mode_ = "volume";
    this.lastTCoord_ = sliceCoords.t;
    this.lastCCoords_ = sliceCoords.c ? [...sliceCoords.c] : undefined;
    this.lastViewProjection_ = viewProjection;
  }

  public allVisibleFallbackLODLoaded(): boolean {
    const fallbackLOD = this.lodRange().max;
    let foundAny = false;
    for (const [chunk, state] of this.chunkViewStates_) {
      if (!state.visible || chunk.lod !== fallbackLOD) continue;
      foundAny = true;
      if (chunk.texture === undefined) return false;
    }
    return foundAny;
  }

  public get currentLOD(): number {
    const { min, max } = this.lodRange();
    return clamp(Math.round(this.targetLOD_), min, max);
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
    this.mode_ = null;
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

  private setLOD(lodFactor: number): boolean {
    // With 2x downsampling per LOD, selection happens in log2 space.
    const bias = this.policy_.lod.bias;

    // How many LOD 0 pixels per screen pixel, normalized by source scale.
    const sourceAdjusted = -Math.log2(this.scale0_) - lodFactor;
    const previousLOD = this.currentLOD;
    this.targetLOD_ = bias - 0.5 + sourceAdjusted;
    return this.currentLOD !== previousLOD;
  }

  // Marks the region's chunks at the current and fallback LODs, the prefetch
  // region's other chunks, and the region at the current LOD for each
  // timepoint in the prefetch window.
  private markChunks(
    region: ChunkRegion,
    prefetchRegion: ChunkRegion,
    currentTimeIndex: number,
    channels: number[]
  ): void {
    const currentLOD = this.currentLOD;
    const fallbackLOD = this.lodRange().max;
    const lodsToVisit =
      currentLOD === fallbackLOD ? [currentLOD] : [currentLOD, fallbackLOD];

    // fallback chunks act as a backdrop while currentLOD loads
    for (const lod of lodsToVisit) {
      const isCurrent = lod === currentLOD;
      const isFallback = lod === fallbackLOD;
      prefetchRegion.forEachChunk(lod, currentTimeIndex, channels, (chunk) => {
        const isInBounds = region.contains(chunk);
        const prefetch = isCurrent && !isInBounds;
        const priority = this.computePriority(
          isFallback,
          isCurrent,
          isInBounds,
          prefetch,
          true
        );
        if (priority === null) return;
        this.chunkViewStates_.set(chunk, {
          visible: isInBounds,
          prefetch,
          priority,
          orderKey: region.orderDistance(chunk),
        });
      });
    }

    const numTimePoints = this.store_.dimensions.t?.lods[0].size ?? 1;
    const windowSize = Math.min(this.policy_.prefetch.t, numTimePoints - 1);
    const priority = this.policy_.priorityMap["prefetchTime"];
    for (let i = 1; i <= windowSize; ++i) {
      const t = (currentTimeIndex + i) % numTimePoints;
      region.forEachChunk(currentLOD, t, channels, (chunk) => {
        // nearer along the playback loop first, then nearer the view centre
        const normalizedDistance = clamp(
          region.orderDistance(chunk) / this.sourceMaxSquareDistance2D_,
          0,
          1 - Number.EPSILON
        );
        this.chunkViewStates_.set(chunk, {
          visible: false,
          prefetch: true,
          priority,
          orderKey: i + normalizedDistance,
        });
      });
    }

    this.lastRegion_ = region;
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

  private channelsOfInterest(c: number[] | undefined): number[] {
    return c ?? Array.from({ length: this.store_.channelCount }, (_, i) => i);
  }

  private lodRange(): { min: number; max: number } {
    const lowestResLOD = this.store_.getLowestResLOD();
    const min = Math.max(0, Math.min(lowestResLOD, this.policy_.lod.min));
    const max = Math.max(min, Math.min(lowestResLOD, this.policy_.lod.max));
    return { min, max };
  }

  private timeIndex(t: number | undefined): number {
    const tDim = this.store_.dimensions.t;
    if (t === undefined || tDim === undefined) return 0;
    return coordToIndex(tDim.lods[0], t);
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

  private cCoordsChanged(newC?: number[]): boolean {
    if (!this.lastCCoords_ && !newC) return false;
    if (!this.lastCCoords_ || !newC) return true;
    if (this.lastCCoords_.length !== newC.length) return true;
    return !this.lastCCoords_.every((v, i) => v === newC[i]);
  }
}

type IndexRanges = Record<SpatialAxis, [number, number]>;

// The chunks a view covers, as half-open chunk-index ranges on each axis at
// each LOD. Slices bound the plane by the view rect and the slice axis by the
// chunk holding the slice. Volumes cover every chunk for now.
class ChunkRegion {
  private readonly store_: ChunkStore;
  private readonly ranges_: readonly IndexRanges[];
  private readonly center_?: { axes: SliceAxes; point: vec2 };

  private constructor(
    store: ChunkStore,
    ranges: readonly IndexRanges[],
    center?: { axes: SliceAxes; point: vec2 }
  ) {
    this.store_ = store;
    this.ranges_ = ranges;
    this.center_ = center;
  }

  // `pad` grows the plane by whole chunks of the current LOD in world units
  // and the slice axis by chunks, converted for other LODs.
  public static forSlice(
    store: ChunkStore,
    axes: SliceAxes,
    viewRect: Box2,
    sliceCoordW: number | undefined,
    currentLOD: number,
    pad: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }
  ): ChunkRegion {
    const { u, v, w } = axes;
    const dimensions = store.dimensions;
    const uLods = dimensions[u]!.lods;
    const vLods = dimensions[v]!.lods;
    const wDim = dimensions[w];
    const uPad = uLods[currentLOD].chunkSize * uLods[currentLOD].scale * pad.x;
    const vPad = vLods[currentLOD].chunkSize * vLods[currentLOD].scale * pad.y;

    const ranges: IndexRanges[] = [];
    for (let lod = 0; lod < store.lodCount; lod++) {
      const range = wholeGrid(store, lod);
      range[u] = axisIndexRange(
        uLods[lod],
        viewRect.min[0] - uPad,
        viewRect.max[0] + uPad
      );
      range[v] = axisIndexRange(
        vLods[lod],
        viewRect.min[1] - vPad,
        viewRect.max[1] + vPad
      );
      if (wDim !== undefined && sliceCoordW !== undefined) {
        range[w] = sliceIndexRange(wDim, lod, currentLOD, sliceCoordW, pad.z);
      }
      ranges.push(range);
    }

    const center = vec2.lerp(vec2.create(), viewRect.min, viewRect.max, 0.5);
    return new ChunkRegion(store, ranges, { axes, point: center });
  }

  // TODO: bound by the view frustum
  public static forVolume(store: ChunkStore): ChunkRegion {
    const ranges: IndexRanges[] = [];
    for (let lod = 0; lod < store.lodCount; lod++) {
      ranges.push(wholeGrid(store, lod));
    }
    return new ChunkRegion(store, ranges);
  }

  public contains(chunk: Chunk): boolean {
    const { x, y, z } = this.ranges_[chunk.lod];
    const index = chunk.chunkIndex;
    return inRange(index.x, x) && inRange(index.y, y) && inRange(index.z, z);
  }

  public forEachChunk(
    lod: number,
    t: number,
    channels: number[],
    callback: (chunk: Chunk) => void
  ): void {
    const { x, y, z } = this.ranges_[lod];
    for (const c of channels) {
      const grid = this.store_.getChunkGrid(lod, t, c);
      if (!grid) continue;
      for (let zi = z[0]; zi < z[1]; ++zi) {
        for (let yi = y[0]; yi < y[1]; ++yi) {
          for (let xi = x[0]; xi < x[1]; ++xi) {
            callback(grid[zi][yi][xi]);
          }
        }
      }
    }
  }

  // Squared distance from the view centre in the slice plane, used to order
  // requests. Zero for volumes.
  public orderDistance(chunk: Chunk): number {
    if (this.center_ === undefined) return 0;
    const { axes, point } = this.center_;
    const du = chunkCenter(chunk, axes.u) - point[0];
    const dv = chunkCenter(chunk, axes.v) - point[1];
    return du * du + dv * dv;
  }
}

function wholeGrid(store: ChunkStore, lod: number): IndexRanges {
  const count = (axis: SpatialAxis): [number, number] => {
    const dim = store.dimensions[axis]?.lods[lod];
    return [0, dim ? Math.ceil(dim.size / dim.chunkSize) : 1];
  };
  return { x: count("x"), y: count("y"), z: count("z") };
}

function axisIndexRange(
  lod: SourceDimensionLod,
  min: number,
  max: number
): [number, number] {
  const stride = lod.chunkSize * lod.scale;
  const count = Math.ceil(lod.size / lod.chunkSize);
  return [
    Math.max(0, Math.floor((min - lod.translation) / stride)),
    Math.min(count, Math.ceil((max - lod.translation) / stride)),
  ];
}

// The chunk holding the slice, padded by `pad` chunks at the current LOD.
// Computed from the slice coordinate rather than chunk edges in world units,
// which lose precision.
function sliceIndexRange(
  wDim: SourceDimension,
  lod: number,
  currentLOD: number,
  sliceCoordW: number,
  pad: number
): [number, number] {
  const wLod = wDim.lods[lod];
  const count = Math.ceil(wLod.size / wLod.chunkSize);

  // other LODs pad by enough of their own chunks to cover the same depth
  const current = wDim.lods[currentLOD];
  const lodPad =
    lod === currentLOD
      ? pad
      : Math.ceil(
          (pad * current.chunkSize * current.scale) /
            (wLod.chunkSize * wLod.scale)
        );

  // floors to the voxel before dividing so the chunk index is exact
  const voxel = Math.floor((sliceCoordW - wLod.translation) / wLod.scale);
  const index = clamp(Math.floor(voxel / wLod.chunkSize), 0, count - 1);
  return [Math.max(0, index - lodPad), Math.min(count, index + lodPad + 1)];
}

function inRange(index: number, [min, max]: [number, number]): boolean {
  return index >= min && index < max;
}

function chunkCenter(chunk: Chunk, axis: SpatialAxis): number {
  return chunk.offset[axis] + 0.5 * chunk.shape[axis] * chunk.scale[axis];
}

function resetChunkViewState(state: ChunkViewState): void {
  state.visible = false;
  state.prefetch = false;
  state.priority = null;
  state.orderKey = null;
}
