import {
  Chunk,
  ChunkLoader,
  ChunkSource,
  DimensionMap,
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
  private readonly dimensions_: DimensionMap;
  private readonly attrs_: ReadonlyArray<LoaderAttributes>;
  private readonly lowestResLOD_: number;
  private currentLOD_: number = 0;
  private lastViewBounds2D_: Box2 | null = null;

  constructor(
    loader: ChunkLoader,
    attrs: ReadonlyArray<LoaderAttributes>,
    region: Region
  ) {
    this.loader_ = loader;
    this.attrs_ = attrs;
    this.lowestResLOD_ = attrs.length - 1;
    this.currentLOD_ = 0;

    this.dimensions_ = this.loader_.getDimensionMap(region);
    const xIdx = this.dimensions_.x.sourceIndex;
    const yIdx = this.dimensions_.y.sourceIndex;
    const zIdx = this.dimensions_.z?.sourceIndex ?? -1;
    const channelIdx = this.dimensions_.c?.sourceIndex ?? -1;

    this.validateXYScaleRatios(xIdx, yIdx);

    // generate chunks for each LOD without loading data
    this.chunks_ = [];
    for (let lod = 0; lod < this.attrs_.length; ++lod) {
      const { chunks, scale, shape, translation } = this.attrs_[lod];
      const chunkWidth = chunks[xIdx];
      const chunkHeight = chunks[yIdx];
      const chunkDepth = chunks[zIdx] ?? 1;
      const chunkChannels = chunks[channelIdx] ?? 1;

      const chunksX = Math.ceil(shape[xIdx] / chunkWidth);
      const chunksY = Math.ceil(shape[yIdx] / chunkHeight);
      const chunksZ = Math.ceil((shape[zIdx] ?? 1) / chunkDepth);

      const channels = shape[channelIdx] ?? 1;
      const chunksC = Math.ceil(channels / chunkChannels);

      for (let x = 0; x < chunksX; ++x) {
        const xOffset = translation[xIdx] + x * chunkWidth * scale[xIdx];
        for (let y = 0; y < chunksY; ++y) {
          const yOffset = translation[yIdx] + y * chunkHeight * scale[yIdx];
          for (let z = 0; z < chunksZ; ++z) {
            const zOffset =
              zIdx !== -1
                ? translation[zIdx] + z * chunkDepth * scale[zIdx]
                : 0;
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
  }

  public getDimensions(): DimensionMap {
    return this.dimensions_;
  }

  public getAttributes(): ReadonlyArray<LoaderAttributes> {
    return this.attrs_;
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
      this.loadChunkData(chunk);
    }
  }

  private loadChunkData(chunk: Chunk): void {
    chunk.state = "loading";
    this.loader_
      .loadChunkData(chunk, this.dimensions_)
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
    if (zDim === undefined) return [0, 0];
    const zIdx = zDim.sourceIndex;
    const lodAttrs = this.attrs_[this.currentLOD_];

    const zShape = lodAttrs.shape[zIdx];
    const zScale = lodAttrs.scale[zIdx];
    const zTran = lodAttrs.translation[zIdx];
    const zPoint = Math.floor((zDim.pointWorld - zTran) / zScale);
    const chunkDepth = lodAttrs.chunks[zIdx];

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
    const xIdx = this.dimensions_.x.sourceIndex;
    const yIdx = this.dimensions_.y.sourceIndex;

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
