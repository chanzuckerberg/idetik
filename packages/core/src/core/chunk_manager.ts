import {
  Chunk,
  ChunkLoader,
  ChunkSource,
  LoaderAttributes,
} from "../data/chunk";
import { Region } from "../data/region";
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
  private readonly region_;
  private readonly attrs_: ReadonlyArray<LoaderAttributes>;
  private readonly lowestResLOD_: number;
  private currentLOD_: number = 0;
  private readonly xIdx_: number;
  private readonly yIdx_: number;
  private readonly zIdx_: number;
  private readonly channelIdx_: number;
  private lastViewBounds2D_: Box2 | null = null;

  constructor(
    loader: ChunkLoader,
    attrs: ReadonlyArray<LoaderAttributes>,
    region: Region
  ) {
    this.loader_ = loader;
    this.region_ = region;
    this.attrs_ = attrs;
    this.lowestResLOD_ = attrs.length - 1;
    this.currentLOD_ = 0;

    this.xIdx_ = region.findIndex(
      (entry) => entry.dimension.toLowerCase() === "x"
    );
    this.yIdx_ = region.findIndex(
      (entry) => entry.dimension.toLowerCase() === "y"
    );
    this.zIdx_ = region.findIndex(
      (entry) => entry.dimension.toLowerCase() === "z"
    );
    this.channelIdx_ = region.findIndex(
      (entry) => entry.dimension.toLowerCase() === "c"
    );

    if (this.xIdx_ === -1 || this.yIdx_ === -1) {
      throw new Error("Missing required spatial axis x/y");
    }

    this.validateXYScaleRatios(this.xIdx_, this.yIdx_);

    // generate chunks for each LOD without loading data
    this.chunks_ = [];
    for (let lod = 0; lod < this.attrs_.length; ++lod) {
      const chunkWidth = this.attrs_[lod].chunks[this.xIdx_];
      const chunkHeight = this.attrs_[lod].chunks[this.yIdx_];
      const chunkDepth =
        this.zIdx_ !== -1 ? this.attrs_[lod].chunks[this.zIdx_] : 1;
      const chunkChannels = this.attrs_[lod].chunks[this.channelIdx_] ?? 1;

      const chunksX = Math.ceil(
        this.attrs_[lod].shape[this.xIdx_] / chunkWidth
      );
      const chunksY = Math.ceil(
        this.attrs_[lod].shape[this.yIdx_] / chunkHeight
      );
      const chunksZ =
        this.zIdx_ !== -1
          ? Math.ceil(this.attrs_[lod].shape[this.zIdx_] / chunkDepth)
          : 1;

      const channels = this.attrs_[lod].shape[this.channelIdx_] ?? 1;
      const chunksC = Math.ceil(channels / chunkChannels);

      const scale = this.attrs_[lod].scale;
      const translation = this.attrs_[lod].translation;
      for (let x = 0; x < chunksX; ++x) {
        for (let y = 0; y < chunksY; ++y) {
          for (let z = 0; z < chunksZ; ++z) {
            for (let c = 0; c < chunksC; ++c) {
              this.chunks_.push({
                state: "unloaded",
                lod,
                visible: false,
                prefetch: false,
                shape: {
                  x: chunkWidth,
                  y: chunkHeight,
                  z: chunkDepth,
                  c: chunkChannels,
                },
                rowStride: chunkWidth,
                rowAlignmentBytes: 1,
                chunkIndex: { x, y, z, c },
                scale: {
                  x: scale[this.xIdx_],
                  y: scale[this.yIdx_],
                  z: this.zIdx_ !== -1 ? scale[this.zIdx_] : 1,
                },
                offset: {
                  x:
                    translation[this.xIdx_] +
                    x * chunkWidth * scale[this.xIdx_],
                  y:
                    translation[this.yIdx_] +
                    y * chunkHeight * scale[this.yIdx_],
                  z:
                    this.zIdx_ !== -1
                      ? translation[this.zIdx_] +
                        z * chunkDepth * scale[this.zIdx_]
                      : 0,
                },
              });
            }
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
    if (this.viewBounds2DChanged(viewBounds2D)) {
      this.updateChunkVisibility(viewBounds2D);
    }
    this.loadPendingChunks();
  }

  public get lodCount() {
    return this.lowestResLOD_ + 1;
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

      // TEMP: visibility is 2D. Ignore nonzero Z until chunk prioritization exists.
      if (chunk.chunkIndex.z !== 0) continue;

      this.loadChunkData(chunk);
    }
  }

  private loadChunkData(chunk: Chunk): void {
    chunk.state = "loading";
    this.loader_
      .loadChunkDataFromRegion(chunk, this.region_)
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
      // TEMP: visibility is 2D. Ignore nonzero Z until chunk prioritization exists.
      if (chunk.chunkIndex.z !== 0) continue;

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
    if (this.zIdx_ === -1) return [0, 0];
    const index = this.region_[this.zIdx_].index;
    if (index.type !== "point") {
      throw new Error("Intervals are currently not supported.");
    }

    const zShape = this.attrs_[this.currentLOD_].shape[this.zIdx_];
    const zScale = this.attrs_[this.currentLOD_].scale[this.zIdx_];
    const zTran = this.attrs_[this.currentLOD_].translation[this.zIdx_];
    const zPoint = Math.floor((index.value - zTran) / zScale);
    const chunkDepth = this.attrs_[this.currentLOD_].chunks[this.zIdx_];

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

  private getPaddedBounds(bounds: Box3): Box3 {
    const chunkWidth =
      this.attrs_[this.currentLOD_].chunks[this.xIdx_] *
      this.attrs_[this.currentLOD_].scale[this.xIdx_];

    const chunkHeight =
      this.attrs_[this.currentLOD_].chunks[this.yIdx_] *
      this.attrs_[this.currentLOD_].scale[this.yIdx_];

    const chunkDepth =
      this.attrs_[this.currentLOD_].chunks[this.zIdx_] *
      this.attrs_[this.currentLOD_].scale[this.zIdx_];

    const padX = chunkWidth * PREFETCH_PADDING_CHUNKS;
    const padY = chunkHeight * PREFETCH_PADDING_CHUNKS;
    const padZ = chunkDepth * PREFETCH_PADDING_CHUNKS;

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

  public async addSource(source: ChunkSource, region: Region) {
    let existing = this.sources_.get(source);
    if (!existing) {
      const loader = await source.open();
      const attrs = loader.getAttributes();
      existing = new ChunkManagerSource(loader, attrs, region);
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
