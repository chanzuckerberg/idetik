import {
  ImageChunk,
  ImageChunkLoader,
  ImageChunkSource,
  LoaderAttributes,
} from "../data/image_chunk";
import { Region } from "../data/region";
import { Camera } from "../objects/cameras/camera";
import { vec2, vec4, mat4 } from "gl-matrix";
import { almostEqual } from "../utilities/almost_equal";
import { Logger } from "../utilities/logger";

type Bounds = { min: vec2; max: vec2 };

export class ChunkManagerSource {
  private readonly chunks_: ImageChunk[];
  private readonly loader_;
  private readonly region_;
  private readonly attrs_: LoaderAttributes[];
  private readonly lowestResLOD_: number;
  private currentLOD_: number = 0;
  private readonly xIdx_: number;
  private readonly yIdx_: number;
  private readonly channelIdx_: number;
  private lastVisibleBounds_: Bounds | null = null;

  constructor(
    loader: ImageChunkLoader,
    attrs: LoaderAttributes[],
    region: Region
  ) {
    this.loader_ = loader;
    this.region_ = region;
    this.attrs_ = attrs;
    this.lowestResLOD_ = attrs.length - 1;
    this.currentLOD_ = 0;

    this.xIdx_ = region.findIndex(
      (entry) => entry.dimension.toLocaleLowerCase() === "x"
    );
    this.yIdx_ = region.findIndex(
      (entry) => entry.dimension.toLocaleLowerCase() === "y"
    );
    if (this.xIdx_ === -1 || this.yIdx_ === -1) {
      throw new Error("Missing required spatial axis x/y");
    }
    this.validateScaleRatios(this.xIdx_, this.yIdx_);
    let channelIdx = region.findIndex(
      (entry) => entry.dimension.toLowerCase() === "c"
    );
    if (channelIdx === -1) {
      channelIdx = 0;
    }
    this.channelIdx_ = channelIdx;
    // generate chunks for each LOD without loading data
    this.chunks_ = [];
    for (let lod = 0; lod < this.attrs_.length; ++lod) {
      const chunkWidth = this.attrs_[lod].chunks[this.xIdx_];
      const chunkHeight = this.attrs_[lod].chunks[this.yIdx_];
      const chunksX = Math.ceil(
        this.attrs_[lod].shape[this.xIdx_] / chunkWidth
      );
      const chunksY = Math.ceil(
        this.attrs_[lod].shape[this.yIdx_] / chunkHeight
      );
      const channels =
        this.attrs_[lod].shape.length === 3
          ? this.attrs_[lod].shape[this.channelIdx_]
          : 1;
      for (let x = 0; x < chunksX; ++x) {
        for (let y = 0; y < chunksY; ++y) {
          this.chunks_.push({
            state: "unloaded",
            lod,
            visible: false,
            shape: {
              x: chunkWidth,
              y: chunkHeight,
              c: channels,
            },
            rowStride: chunkWidth,
            rowAlignmentBytes: 1,
            chunkIndex: { x, y },
            scale: {
              x: this.attrs_[lod].scale[this.xIdx_],
              y: this.attrs_[lod].scale[this.yIdx_],
            },
            offset: {
              x: x * chunkWidth * this.attrs_[lod].scale[this.xIdx_],
              y: y * chunkHeight * this.attrs_[lod].scale[this.yIdx_],
            },
          });
        }
      }
    }
  }

  public getChunks(): ImageChunk[] {
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

    const fallbackChunks = this.getFallbackChunks();

    return [...fallbackChunks, ...currentLODChunks];
  }

  public loadVisibleChunks() {
    // Load background LOD (lowest resolution) first if not already started
    const backgroundChunks = this.chunks_.filter(
      (chunk) => chunk.lod === this.lowestResLOD_
    );
    const allVisibleBackgroundLoaded = backgroundChunks.every(
      (chunk) => chunk.state === "loaded"
    );

    if (!allVisibleBackgroundLoaded) {
      this.loadBackgroundLOD();
    }

    for (const chunk of this.chunks_) {
      // Only load chunks for current LOD
      if (chunk.lod === this.currentLOD_ && chunk.state === "unloaded") {
        this.processChunkData(chunk);
      }
    }
  }

  private getFallbackChunks(): ImageChunk[] {
    // Only use the lowest resolution LOD (highest LOD number) as fallback
    return this.chunks_.filter(
      (chunk) =>
        chunk.lod === this.lowestResLOD_ &&
        chunk.visible &&
        chunk.state === "loaded"
    );
  }

  private loadBackgroundLOD(): void {
    const backgroundChunks = this.chunks_.filter(
      (chunk) => chunk.lod === this.lowestResLOD_
    );

    for (const chunk of backgroundChunks) {
      if (chunk.state === "unloaded") {
        this.processChunkData(chunk);
      }
    }
  }

  public update(lodFactor: number, visibleBounds: Bounds) {
    this.setLOD(lodFactor);

    if (visibleBounds !== this.lastVisibleBounds_) {
      this.updateChunkVisibility(visibleBounds);
      this.lastVisibleBounds_ = {
        min: vec2.clone(visibleBounds.min),
        max: vec2.clone(visibleBounds.max),
      };
    }

    this.loadVisibleChunks();
  }

  private processChunkData(chunk: ImageChunk): void {
    chunk.state = "loading";
    this.loader_
      .loadChunkDataFromRegion(chunk, this.region_)
      .then(() => {
        chunk.state = "loaded";
      })
      .catch((error) => {
        Logger.error(
          "ChunkManager",
          `Error loading chunk (${chunk.chunkIndex?.x},${chunk.chunkIndex?.y}): ${error}`
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
      this.currentLOD_ = targetLOD;

      // Unload chunks from all LODs except current and background
      this.unloadUnneededLODs();
    }
  }

  private unloadUnneededLODs(): void {
    const chunksToUnload = this.chunks_.filter(
      (chunk) =>
        chunk.lod !== this.currentLOD_ &&
        chunk.lod !== this.lowestResLOD_ &&
        chunk.state === "loaded"
    );

    for (const chunk of chunksToUnload) {
      chunk.state = "unloaded";
      chunk.data = undefined;
    }
  }

  private updateChunkVisibility(visibleBounds: Bounds): void {
    if (this.chunks_.length === 0) {
      Logger.warn(
        "ChunkManager",
        "updateChunkVisibility called with no chunks initialized"
      );
      return;
    }

    for (const chunk of this.chunks_) {
      if (!chunk.chunkIndex) {
        chunk.visible = false;
        continue;
      }

      const chunkVirtualWidth = chunk.shape.x * chunk.scale.x;
      const chunkVirtualHeight = chunk.shape.y * chunk.scale.y;

      const minChunkIndexX = Math.floor(
        visibleBounds.min[0] / chunkVirtualWidth
      );
      const maxChunkIndexX = Math.ceil(
        visibleBounds.max[0] / chunkVirtualWidth
      );
      const minChunkIndexY = Math.floor(
        visibleBounds.min[1] / chunkVirtualHeight
      );
      const maxChunkIndexY = Math.ceil(
        visibleBounds.max[1] / chunkVirtualHeight
      );

      const { x, y } = chunk.chunkIndex;
      chunk.visible =
        x >= minChunkIndexX &&
        x <= maxChunkIndexX &&
        y >= minChunkIndexY &&
        y <= maxChunkIndexY;
    }
  }

  private validateScaleRatios(xIdx: number, yIdx: number): void {
    const availableScales = this.attrs_.map((attr) => attr.scale);
    for (let i = 1; i < availableScales.length; i++) {
      const prev = availableScales[i - 1];
      const curr = availableScales[i];
      const rx = curr[xIdx] / prev[xIdx];
      const ry = curr[yIdx] / prev[yIdx];

      if (!almostEqual(rx, 2) || !almostEqual(ry, 2)) {
        throw new Error(
          `Scales must be separated by factors of 2. Got ratio (${rx}, ${ry}) between scales ${prev} and ${curr}`
        );
      }
    }
  }
}

export class ChunkManager {
  private readonly sources_ = new Map<ImageChunkSource, ChunkManagerSource>();

  public async addSource(source: ImageChunkSource, region: Region) {
    let existing = this.sources_.get(source);
    if (!existing) {
      const loader = await source.open();
      const attrs = await loader.loadAttributes();
      existing = new ChunkManagerSource(loader, attrs, region);
      this.sources_.set(source, existing);
    }
    return existing;
  }

  public update(camera: Camera, _bufferWidth: number, _bufferHeight: number) {
    const visibleBounds = this.computeVisibleBounds(camera);
    const virtualWidth = Math.abs(visibleBounds.max[0] - visibleBounds.min[0]);
    const virtualUnitsPerScreenPixel = virtualWidth / _bufferWidth;
    const lodFactor = Math.log2(1 / virtualUnitsPerScreenPixel);

    for (const [_, chunkManagerSource] of this.sources_) {
      chunkManagerSource.update(lodFactor, visibleBounds);
    }
  }

  private computeVisibleBounds(camera: Camera): Bounds {
    let topLeft = vec4.fromValues(-1.0, -1.0, 0.0, 1.0);
    let bottomRight = vec4.fromValues(1.0, 1.0, 0.0, 1.0);

    const viewProjection = mat4.multiply(
      mat4.create(),
      camera.projectionMatrix,
      camera.viewMatrix
    );

    const inv = mat4.invert(mat4.create(), viewProjection);
    topLeft = vec4.transformMat4(vec4.create(), topLeft, inv);
    bottomRight = vec4.transformMat4(vec4.create(), bottomRight, inv);

    return {
      min: vec2.fromValues(topLeft[0], topLeft[1]),
      max: vec2.fromValues(bottomRight[0], bottomRight[1]),
    };
  }
}
