import { Chunk, SliceCoordinates } from "./chunk";
import { vec2, vec3 } from "gl-matrix";
import { Box2 } from "../math/box2";
import { Box3 } from "../math/box3";
import { Logger } from "../utilities/logger";
import { CachedChunkLoader } from "./cached_chunk_loader";
import { OrthographicCamera } from "../objects/cameras/orthographic_camera";
import { almostEqual } from "../utilities/almost_equal";

// Number of chunks to extend beyond the visible bounds in each direction (x/y/z)
// These additional chunks are prefetched to improve responsiveness when panning.
const PREFETCH_PADDING_CHUNKS = 1;

export class ChunkSourceView {
  private readonly loader_: CachedChunkLoader;
  private readonly lowestResLOD_: number;
  private currentLOD_: number = 0;
  private lastViewBounds2D_: Box2 | null = null;
  private lastZBounds_?: [number, number];

  constructor(loader: CachedChunkLoader) {
    this.loader_ = loader;
    this.currentLOD_ = 0;
    this.lowestResLOD_ = this.dimensions.numLods - 1;
    this.validateXYScaleRatios();
  }

  public get chunks(): Chunk[] {
    return this.loader_.chunks;
  }

  public get lodCount() {
    return this.lowestResLOD_ + 1;
  }

  public get dimensions() {
    return this.loader_.dimensions;
  }

  public get currentLOD(): number {
    return this.currentLOD_;
  }

  public getChunks(): Chunk[] {
    const currentLODChunks = this.chunks.filter(
      (chunk) =>
        chunk.lod === this.currentLOD_ &&
        chunk.visible &&
        chunk.state === "loaded"
    );

    // If we're at the lowest resolution LOD, only return current LOD chunks
    if (this.currentLOD_ === this.lowestResLOD_) {
      return currentLODChunks;
    }

    const lowResChunks = this.chunks.filter(
      (chunk) =>
        chunk.lod === this.lowestResLOD_ &&
        chunk.visible &&
        chunk.state === "loaded"
    );

    return [...lowResChunks, ...currentLODChunks];
  }

  public update(
    camera: OrthographicCamera,
    bufferWidth: number,
    sliceCoords: SliceCoordinates
  ) {
    const viewBounds2D = camera.getWorldViewRect();
    const virtualWidth = Math.abs(viewBounds2D.max[0] - viewBounds2D.min[0]);
    const virtualUnitsPerScreenPixel = virtualWidth / bufferWidth;
    const lodFactor = Math.log2(1 / virtualUnitsPerScreenPixel);

    this.setLOD(lodFactor);
    const zBounds = this.getZBounds(sliceCoords);

    if (
      this.viewBounds2DChanged(viewBounds2D) ||
      this.zBoundsChanged(zBounds)
    ) {
      this.updateChunkVisibility(viewBounds2D, sliceCoords);
    }

    this.loadPendingChunks(sliceCoords);
  }

  private loadPendingChunks(sliceCoords: SliceCoordinates) {
    this.loadLowResChunks(sliceCoords);

    for (const chunk of this.chunks) {
      if (
        chunk.lod === this.currentLOD_ &&
        chunk.state === "unloaded" &&
        (chunk.visible || chunk.prefetch)
      ) {
        this.loader_.loadChunkData(chunk, sliceCoords);
      }
    }
  }

  private loadLowResChunks(sliceCoords: SliceCoordinates): void {
    for (const chunk of this.chunks) {
      if (chunk.lod !== this.lowestResLOD_ || chunk.state !== "unloaded")
        continue;
      this.loader_.loadChunkData(chunk, sliceCoords);
    }
  }

  private setLOD(lodFactor: number): void {
    const maxLOD = this.dimensions.numLods - 1;
    const targetLOD = Math.max(
      0,
      Math.min(maxLOD, Math.floor(maxLOD - lodFactor))
    );

    if (targetLOD !== this.currentLOD_) {
      Logger.debug(
        "ChunkManager",
        `LOD changed from ${this.currentLOD_} to ${targetLOD}`
      );
      this.currentLOD_ = targetLOD;
    }
  }

  private updateChunkVisibility(
    viewBounds2D: Box2,
    sliceCoords: SliceCoordinates
  ): void {
    if (this.chunks.length === 0) {
      Logger.warn(
        "ChunkManager",
        "updateChunkVisibility called with no chunks initialized"
      );
      return;
    }

    const [zMin, zMax] = this.getZBounds(sliceCoords);
    const viewBounds3D = new Box3(
      vec3.fromValues(viewBounds2D.min[0], viewBounds2D.min[1], zMin),
      vec3.fromValues(viewBounds2D.max[0], viewBounds2D.max[1], zMax)
    );

    const paddedBounds = this.getPaddedBounds(viewBounds3D);
    for (const chunk of this.chunks) {
      const isVisible = this.isChunkWithinBounds(chunk, viewBounds3D);
      const eligibleForPrefetch =
        !isVisible && this.isChunkWithinBounds(chunk, paddedBounds);

      const isCurrentLOD = chunk.lod === this.currentLOD_;
      const isFallbackLOD = chunk.lod === this.lowestResLOD_;
      const isLoaded = chunk.state === "loaded";

      chunk.visible = isVisible;
      chunk.prefetch = eligibleForPrefetch && isCurrentLOD && !isLoaded;

      if (isLoaded && !isFallbackLOD) {
        const shouldDispose =
          !isCurrentLOD || (isCurrentLOD && !isVisible && !eligibleForPrefetch);

        if (shouldDispose) {
          chunk.data = undefined;
          chunk.state = "unloaded";
          Logger.debug("ChunkManager", `Disposing chunk in LOD ${chunk.lod}`);
        }
      }
    }
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
    const zDim = this.dimensions.z;
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
    const prev = this.lastViewBounds2D_;
    const changed =
      prev === null ||
      !vec2.equals(prev.min, newBounds.min) ||
      !vec2.equals(prev.max, newBounds.max);

    if (changed) {
      this.lastViewBounds2D_ = new Box2(
        vec2.clone(newBounds.min),
        vec2.clone(newBounds.max)
      );
    }

    return changed;
  }

  private zBoundsChanged(newBounds: [number, number]): boolean {
    const prev = this.lastZBounds_;
    const changed = !prev || !vec2.equals(prev, newBounds);
    if (changed) {
      this.lastZBounds_ = newBounds;
    }
    return changed;
  }

  private getPaddedBounds(bounds: Box3): Box3 {
    const xDim = this.dimensions.x.lods[this.currentLOD_];
    const yDim = this.dimensions.y.lods[this.currentLOD_];

    const padX = xDim.chunkSize * xDim.scale * PREFETCH_PADDING_CHUNKS;
    const padY = yDim.chunkSize * yDim.scale * PREFETCH_PADDING_CHUNKS;

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

  private validateXYScaleRatios(): void {
    // Validates that each LOD level is downsampled by a factor of 2 in X and Y.
    // Z downsampling is not validated here because it may be inconsistent or
    // completely absent in some pyramids.
    const xDim = this.dimensions.x;
    const yDim = this.dimensions.y;
    for (let i = 1; i < this.dimensions.numLods; i++) {
      const rx = xDim.lods[i].scale / xDim.lods[i - 1].scale;
      const ry = xDim.lods[i].scale / yDim.lods[i - 1].scale;

      if (!almostEqual(rx, 2) || !almostEqual(ry, 2)) {
        throw new Error(
          `Invalid downsampling factor between levels ${i - 1} → ${i}: ` +
            `expected (2× in X and Y), but got ` +
            `(${rx.toFixed(2)}×, ${ry.toFixed(2)}×) from scale ` +
            `[${xDim.lods[i - 1].scale}, ${yDim.lods[i - 1].scale}] → [${xDim.lods[i].scale}, ${yDim.lods[i].scale}]`
        );
      }
    }
  }
}
