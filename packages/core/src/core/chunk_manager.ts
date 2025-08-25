import {
  Chunk,
  ChunkDimensionMap,
  ChunkLoader,
  ChunkSource,
  LoaderAttributes,
  SliceIndices,
} from "../data/chunk";
import { vec2, vec3 } from "gl-matrix";
import { Box2 } from "../math/box2";
import { Box3 } from "../math/box3";
import { almostEqual } from "../utilities/almost_equal";
import { Logger } from "../utilities/logger";
import { OrthographicCamera } from "@/objects/cameras/orthographic_camera";

// Number of chunks to extend beyond the visible bounds in each direction (x/y/z)
// These additional chunks are prefetched to improve responsiveness when panning.
const PREFETCH_PADDING_CHUNKS = 1;

export class ChunkManagerSource {
  private readonly chunks_: Chunk[];
  private readonly loader_;
  private readonly attrs_: ReadonlyArray<LoaderAttributes>;
  private readonly lowestResLOD_: number;
  private readonly sliceIndices_: SliceIndices;
  private dimensions_: ChunkDimensionMap;
  private currentLOD_: number = 0;
  private lastViewBounds2D_: Box2 | null = null;
  private lastZBounds_?: [number, number];

  constructor(
    loader: ChunkLoader,
    attrs: ReadonlyArray<LoaderAttributes>,
    sliceIndices: SliceIndices
  ) {
    this.loader_ = loader;
    this.attrs_ = attrs;
    this.lowestResLOD_ = attrs.length - 1;
    this.currentLOD_ = 0;

    this.sliceIndices_ = sliceIndices;
    this.dimensions_ = this.loader_.getDimensionMap();
    const xIdx = this.dimensions_.x.index;
    const yIdx = this.dimensions_.y.index;
    const zIdx = this.dimensions_.z?.index ?? -1;
    const channelIdx = this.dimensions_.c?.index ?? -1;

    this.validateXYScaleRatios(xIdx, yIdx);

    // generate chunks for each LOD without loading data
    this.chunks_ = [];
    for (let lod = 0; lod < this.attrs_.length; ++lod) {
      const { chunks, scale, shape, translation } = this.attrs_[lod];
      const chunkWidth = chunks[xIdx];
      const chunkHeight = chunks[yIdx];
      const chunkDepth = chunks[zIdx] ?? 1;

      const chunksX = Math.ceil(shape[xIdx] / chunkWidth);
      const chunksY = Math.ceil(shape[yIdx] / chunkHeight);
      const chunksZ = Math.ceil((shape[zIdx] ?? 1) / chunkDepth);
      const channels = shape[channelIdx] ?? 1;

      for (let x = 0; x < chunksX; ++x) {
        const xOffset = translation[xIdx] + x * chunkWidth * scale[xIdx];
        for (let y = 0; y < chunksY; ++y) {
          const yOffset = translation[yIdx] + y * chunkHeight * scale[yIdx];
          for (let z = 0; z < chunksZ; ++z) {
            const zOffset =
              zIdx !== -1
                ? translation[zIdx] + z * chunkDepth * scale[zIdx]
                : 0;
            this.chunks_.push({
              state: "unloaded",
              lod,
              visible: false,
              prefetch: false,
              shape: {
                x: chunkWidth,
                y: chunkHeight,
                z: chunkDepth,
                c: channels,
              },
              rowStride: chunkWidth,
              rowAlignmentBytes: 1,
              chunkIndex: { x, y, z },
              scale: {
                x: scale[xIdx],
                y: scale[yIdx],
                z: scale[zIdx] ?? 1,
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

  public getChunks(): Chunk[] {
    const currentLODChunks = this.chunks_.filter(
      (chunk) =>
        chunk.lod === this.currentLOD_ &&
        chunk.visible &&
        chunk.state === "loaded"
    );

    // If we're at the lowest resolution LOD, only return current LOD chunks
    if (this.currentLOD_ === this.lowestResLOD_) {
      return currentLODChunks;
    }

    const lowResChunks = this.chunks_.filter(
      (chunk) =>
        chunk.lod === this.lowestResLOD_ &&
        chunk.visible &&
        chunk.state === "loaded"
    );

    return [...lowResChunks, ...currentLODChunks];
  }

  public update(lodFactor: number, viewBounds2D: Box2) {
    this.setLOD(lodFactor);
    const zBounds = this.getZBounds();

    if (
      this.viewBounds2DChanged(viewBounds2D) ||
      this.zBoundsChanged(zBounds)
    ) {
      this.updateChunkVisibility(viewBounds2D);
    }

    this.loadPendingChunks();
  }

  public get lodCount() {
    return this.lowestResLOD_ + 1;
  }

  public get dimensions() {
    return this.dimensions_;
  }

  public get chunks(): Chunk[] {
    return this.chunks_;
  }

  public get currentLOD(): number {
    return this.currentLOD_;
  }

  private loadPendingChunks() {
    this.loadLowResChunks();

    for (const chunk of this.chunks_) {
      if (
        chunk.lod === this.currentLOD_ &&
        chunk.state === "unloaded" &&
        (chunk.visible || chunk.prefetch)
      ) {
        this.loadChunkData(chunk);
      }
    }
  }

  private loadLowResChunks(): void {
    for (const chunk of this.chunks_) {
      if (chunk.lod !== this.lowestResLOD_ || chunk.state !== "unloaded")
        continue;
      this.loadChunkData(chunk);
    }
  }

  private loadChunkData(chunk: Chunk): void {
    chunk.state = "loading";
    this.loader_
      .loadChunkData(chunk, this.sliceIndices_)
      .then(() => {
        chunk.state = "loaded";
      })
      .catch((error) => {
        Logger.error(
          "ChunkManager",
          `Error loading chunk (${chunk.chunkIndex.x},${chunk.chunkIndex.y},${chunk.chunkIndex.z}): ${error}`
        );
        chunk.state = "unloaded";
      });
  }

  private setLOD(lodFactor: number): void {
    const maxLOD = this.attrs_.length - 1;
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

  private updateChunkVisibility(viewBounds2D: Box2): void {
    if (this.chunks_.length === 0) {
      Logger.warn(
        "ChunkManager",
        "updateChunkVisibility called with no chunks initialized"
      );
      return;
    }

    const [zMin, zMax] = this.getZBounds();
    const viewBounds3D = new Box3(
      vec3.fromValues(viewBounds2D.min[0], viewBounds2D.min[1], zMin),
      vec3.fromValues(viewBounds2D.max[0], viewBounds2D.max[1], zMax)
    );

    const paddedBounds = this.getPaddedBounds(viewBounds3D);
    for (const chunk of this.chunks_) {
      chunk.prefetch = false;
      chunk.visible = this.isChunkWithinBounds(chunk, viewBounds3D);
      if (!chunk.visible) {
        chunk.prefetch = this.isChunkWithinBounds(chunk, paddedBounds);
      }
    }
  }

  private validateXYScaleRatios(xIdx: number, yIdx: number): void {
    // Validates that each LOD level is downsampled by a factor of 2 in X and Y.
    // Z downsampling is not validated here because it may be inconsistent or
    // completely absent in some pyramids.
    const availableScales = this.attrs_.map((attr) => attr.scale);
    for (let i = 1; i < availableScales.length; i++) {
      const prev = availableScales[i - 1];
      const curr = availableScales[i];
      const rx = curr[xIdx] / prev[xIdx];
      const ry = curr[yIdx] / prev[yIdx];

      if (!almostEqual(rx, 2) || !almostEqual(ry, 2)) {
        throw new Error(
          `Invalid downsampling factor between levels ${i - 1} → ${i}: ` +
            `expected (2× in X and Y), but got ` +
            `(${rx.toFixed(2)}×, ${ry.toFixed(2)}×) from scale ` +
            `[${prev.join(", ")}] → [${curr.join(", ")}]`
        );
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

  private getZBounds(): [number, number] {
    const zDim = this.dimensions_.z;
    if (zDim === undefined || this.sliceIndices_.z === undefined) return [0, 1];

    const zLod = zDim.lods[this.currentLOD_];
    const zShape = zLod.size;
    const zScale = zLod.scale;
    const zTran = zLod.translation;
    const zPoint = Math.floor((this.sliceIndices_.z - zTran) / zScale);
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
    const xIdx = this.dimensions_.x.index;
    const yIdx = this.dimensions_.y.index;

    const attrs = this.attrs_[this.currentLOD_];
    const chunkWidth = attrs.chunks[xIdx] * attrs.scale[xIdx];
    const chunkHeight = attrs.chunks[yIdx] * attrs.scale[yIdx];

    const padX = chunkWidth * PREFETCH_PADDING_CHUNKS;
    const padY = chunkHeight * PREFETCH_PADDING_CHUNKS;

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
}

export class ChunkManager {
  private readonly sources_ = new Map<ChunkSource, ChunkManagerSource>();

  public async addSource(source: ChunkSource, sliceIndices: SliceIndices) {
    let existing = this.sources_.get(source);
    if (!existing) {
      const loader = await source.open();
      const attrs = loader.getAttributes();
      existing = new ChunkManagerSource(loader, attrs, sliceIndices);
      this.sources_.set(source, existing);
    }
    return existing;
  }

  public update(camera: OrthographicCamera, bufferWidth: number) {
    if (camera.type !== "OrthographicCamera") {
      throw new Error(
        "ChunkManager currently supports only orthographic cameras. " +
          "Update the implementation before using a perspective camera."
      );
    }

    const viewBounds2D = camera.getWorldViewRect();
    const virtualWidth = Math.abs(viewBounds2D.max[0] - viewBounds2D.min[0]);
    const virtualUnitsPerScreenPixel = virtualWidth / bufferWidth;
    const lodFactor = Math.log2(1 / virtualUnitsPerScreenPixel);

    for (const [_, chunkManagerSource] of this.sources_) {
      chunkManagerSource.update(lodFactor, viewBounds2D);
    }
  }
}
