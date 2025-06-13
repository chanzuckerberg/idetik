import {
  ImageChunk,
  ImageChunkLoader,
  ImageChunkSource,
  LoaderAttributes,
} from "@/data/image_chunk";
import { Region } from "../data/region";
import { Camera } from "../objects/cameras/camera";
import { vec2, vec4, mat4 } from "gl-matrix";

type Bounds = { min: vec2; max: vec2 };

// temporary value. LOD will be computed dynamically
const curr_lod = 0;

export class ChunkManagerSource {
  private readonly chunks_: ImageChunk[][] = [];
  private readonly loader_;
  private readonly region_;

  constructor(
    loader: ImageChunkLoader,
    attrs: LoaderAttributes[],
    region: Region
  ) {
    this.loader_ = loader;
    this.region_ = region;

    // generate chunks for each LOD without loading data
    this.chunks_ = Array(attrs.length)
      .fill(null)
      .map(() => []);
    for (let lod = 0; lod < attrs.length; ++lod) {
      const xIdx = region.findIndex((entry) => entry.dimension === "x");
      const yIdx = region.findIndex((entry) => entry.dimension === "y");
      if (xIdx === -1 || yIdx === -1) {
        throw new Error("Missing required spatial axis x/y");
      }

      const chunkWidth = attrs[lod].chunks[xIdx];
      const chunkHeight = attrs[lod].chunks[yIdx];
      const chunksX = Math.ceil(attrs[lod].shape[xIdx] / chunkWidth);
      const chunksY = Math.ceil(attrs[lod].shape[yIdx] / chunkHeight);
      const channels = attrs[lod].shape.length === 3 ? attrs[lod].shape[0] : 1;
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
              x: attrs[lod].scale[xIdx],
              y: attrs[lod].scale[yIdx],
            },
            offset: {
              x: x * chunkWidth * attrs[lod].scale[xIdx],
              y: y * chunkHeight * attrs[lod].scale[yIdx],
            },
          });
        }
      }
    }
  }

  public getVisibleChunks(): ImageChunk[] {
    return this.chunks_[curr_lod].filter((e) => e.visible);
  }

  public async updateChunks(_: Bounds) {
    // TODO: map the LOD factor from the chunk manager to an available LOD in image space
    // TODO: replace the following block with loading based on intersection tests
    for (const chunk of this.chunks_[curr_lod]) {
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

    // TODO: compute the LOD factor

    for (const [_, chunkManagerSource] of this.sources_) {
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
