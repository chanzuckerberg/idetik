import {
  ImageChunk,
  ImageChunkLoader,
  ImageChunkSource,
  LoaderAttributes,
} from "@/data/image_chunk";
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
    const chunks = this.chunks_.filter(
      (chunk) =>
        chunk.lod === this.currentLOD_ &&
        chunk.visible &&
        chunk.state === "loaded"
    );
    console.debug(chunks);
    return chunks;
  }

  public loadVisibleChunks() {
    for (const chunk of this.chunks_) {
      this.processChunkData(chunk);
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
    if (!chunk.visible || chunk.state !== "unloaded") return;

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
      console.debug(`LOD changed from ${this.currentLOD_} to ${targetLOD}`);
      this.currentLOD_ = targetLOD;
    }
  }

  private updateChunkVisibility(visibleBounds: Bounds): void {
    if (this.chunks_.length === 0) return;
    const firstChunkAtLOD = this.chunks_.find(
      (chunk) => chunk.lod === this.currentLOD_
    );
    if (!firstChunkAtLOD) return;
    const chunkVirtualWidth = firstChunkAtLOD.shape.x * firstChunkAtLOD.scale.x;
    const chunkVirtualHeight =
      firstChunkAtLOD.shape.y * firstChunkAtLOD.scale.y;

    const minChunkIndexX = Math.floor(visibleBounds.min[0] / chunkVirtualWidth);
    const maxChunkIndexX = Math.ceil(visibleBounds.max[0] / chunkVirtualWidth);
    const minChunkIndexY = Math.floor(
      visibleBounds.min[1] / chunkVirtualHeight
    );
    const maxChunkIndexY = Math.ceil(visibleBounds.max[1] / chunkVirtualHeight);

    // Reset visibility and set visible chunks based on index range in a single pass
    for (const chunk of this.chunks_) {
      // exit early if chunks are not at the current LOD
      if (chunk.lod !== this.currentLOD_) {
        chunk.visible = false;
        continue;
      }

      chunk.visible = false;
      if (chunk.chunkIndex) {
        const { x, y } = chunk.chunkIndex;
        if (
          x >= minChunkIndexX &&
          x <= maxChunkIndexX &&
          y >= minChunkIndexY &&
          y <= maxChunkIndexY
        ) {
          chunk.visible = true;
        }
      }
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
