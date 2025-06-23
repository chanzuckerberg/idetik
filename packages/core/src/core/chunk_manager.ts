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

type Bounds = { min: vec2; max: vec2 };

export class ChunkManagerSource {
  private readonly chunks_: ImageChunk[][];
  private readonly loader_;
  private readonly region_;
  private readonly attrs_: LoaderAttributes[];
  private currentLOD_: number = 0;
  private readonly xIdx_: number;
  private readonly yIdx_: number;
  private readonly channelIdx_: number;

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
    let channelIdx = region.findIndex(
      (entry) => entry.dimension.toLowerCase() === "c"
    );
    if (channelIdx === -1) {
      channelIdx = 0;
    }
    this.validateScaleRatios(this.xIdx_, this.yIdx_);
    this.channelIdx_ = channelIdx;
    // generate chunks for each LOD without loading data
    this.chunks_ = Array(this.attrs_.length)
      .fill(null)
      .map(() => []);
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
          this.chunks_[lod].push({
            state: "unloaded",
            lod,
            visible: true, // TODO:(shlomnissan) should be set to false
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

  public getVisibleChunks(): ImageChunk[] {
    return this.chunks_[this.currentLOD_].filter((e) => e.visible);
  }

  public setLOD(lodFactor: number): void {
    const numLods = this.attrs_.length;
    const lodShift = numLods - 1;
    const lodF = lodShift - lodFactor;
    const newLOD = Math.max(0, Math.min(numLods - 1, Math.floor(lodF)));

    if (newLOD !== this.currentLOD_) {
      console.debug(`LOD changed from ${this.currentLOD_} to ${newLOD}`);
      this.currentLOD_ = newLOD;
    }
  }

  public async updateChunks(_: Bounds) {
    // TODO: map the LOD factor from the chunk manager to an available LOD in image space
    // TODO: replace the following block with loading based on intersection tests
    for (const chunk of this.chunks_[this.currentLOD_]) {
      if (chunk.state === "unloaded") {
        chunk.state = "loading";
        this.loader_.loadChunkDataFromRegion(chunk, this.region_).then(() => {
          chunk.state = "loaded";
        });
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
      chunkManagerSource.setLOD(lodFactor);
      chunkManagerSource.updateChunks(visibleBounds);
    }
  }

  private computeVisibleBounds(camera: Camera): Bounds {
    let topLeft = vec4.fromValues(-1.0, 1.0, 0.0, 1.0);
    let bottomRight = vec4.fromValues(1.0, -1.0, 0.0, 1.0);

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
