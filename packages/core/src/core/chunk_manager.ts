import {
  ImageChunk,
  ImageChunkLoader,
  ImageChunkSource,
  LoaderAttributes,
} from "@/data/image_chunk";

import { Camera } from "../objects/cameras/camera";
import { vec2, vec4, mat4 } from "gl-matrix";

type Bounds = { min: vec2; max: vec2 };

export class ChunkManagerSource {
  private readonly chunks_: ImageChunk[][] = [];
  private readonly loader_;
  private currentLOD_: number = 0;

  constructor(loader: ImageChunkLoader, attrs: LoaderAttributes[]) {
    this.loader_ = loader;

    this.chunks_ = Array(attrs.length)
      .fill(null)
      .map(() => []);
    for (let lod = 0; lod < attrs.length; ++lod) {
      const chunkWidth = attrs[lod].chunks[4];
      const chunkHeight = attrs[lod].chunks[3];
      const chunksX = Math.ceil(attrs[lod].shape[4] / chunkWidth);
      const chunksY = Math.ceil(attrs[lod].shape[3] / chunkHeight);
      const channels = attrs[lod].shape.length === 3 ? attrs[lod].shape[0] : 1;
      for (let x = 0; x < chunksX; ++x) {
        for (let y = 0; y < chunksY; ++y) {
          this.chunks_[lod].push({
            state: "unloaded",
            lod,
            visible: false,
            shape: {
              x: chunkWidth,
              y: chunkHeight,
              c: channels,
            },
            rowStride: chunkWidth,
            rowAlignmentBytes: 2, // TODO:(shlomnissan) calculate based on data
            chunkIndex: { x, y },
            scale: {
              x: attrs[lod].scale[4],
              y: attrs[lod].scale[3],
            },
            offset: {
              x: x * chunkWidth * attrs[lod].scale[4],
              y: y * chunkHeight * attrs[lod].scale[3],
            },
          });
        }
      }
    }
  }

  public getVisibleChunks(): ImageChunk[] {
    const visibleChunks = this.chunks_[this.currentLOD_].filter(
      (e) => e.visible
    );
    const visibleAndReady = visibleChunks.filter((e) => e.state === "loaded");
    return visibleAndReady;
  }

  public async updateChunks(visibleBounds: Bounds) {
    // TODO: map the LOD factor to an available LOD in image space
    this.computeVisibleChunks(visibleBounds);

    const currentChunks = this.chunks_[this.currentLOD_];
    for (const chunk of currentChunks) {
      if (chunk.visible && chunk.state === "unloaded") {
        chunk.state = "loading";
        this.loader_
          .loadChunkXYZ(chunk)
          .then(() => {
            chunk.state = "loaded";
          })
          .catch((error) => {
            console.error(
              `Failed to load chunk (${chunk.chunkIndex?.x},${chunk.chunkIndex?.y}):`,
              error
            );
            chunk.state = "unloaded"; // Reset to allow retry
          });
      }
    }
  }

  private computeVisibleChunks(visibleBounds: Bounds): void {
    const currentChunks = this.chunks_[this.currentLOD_];
    if (currentChunks.length === 0) return;

    // Get chunk size in world coordinates for current LOD
    const firstChunk = currentChunks[0];
    const chunkWorldWidth = firstChunk.shape.x * firstChunk.scale.x;
    const chunkWorldHeight = firstChunk.shape.y * firstChunk.scale.y;

    // Compute chunk index range using analytical approach
    const chunkIndexX1 = Math.floor(visibleBounds.min[0] / chunkWorldWidth);
    const chunkIndexX2 = Math.floor(visibleBounds.max[0] / chunkWorldWidth);
    const chunkIndexY1 = Math.floor(visibleBounds.min[1] / chunkWorldHeight);
    const chunkIndexY2 = Math.floor(visibleBounds.max[1] / chunkWorldHeight);

    // Ensure min/max are in correct order
    const minChunkIndexX = Math.min(chunkIndexX1, chunkIndexX2);
    const maxChunkIndexX = Math.max(chunkIndexX1, chunkIndexX2);
    const minChunkIndexY = Math.min(chunkIndexY1, chunkIndexY2);
    const maxChunkIndexY = Math.max(chunkIndexY1, chunkIndexY2);

    // Reset all chunks to not visible first
    for (const chunk of currentChunks) {
      chunk.visible = false;
    }

    // Set visible chunks based on index range
    for (const chunk of currentChunks) {
      if (!chunk.chunkIndex) continue;
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
  public computeLOD(
    visibleBounds: Bounds,
    bufferWidth: number // screen/canvas width in pixels
  ): void {
    // Get available scales from chunks
    const availableScales = this.chunks_.map((_, lod) => [
      1,
      1,
      this.chunks_[lod][0]?.scale.y || 1,
      this.chunks_[lod][0]?.scale.x || 1,
    ]);

    // Calculate virtual width from visible bounds
    const virtualWidth = Math.abs(visibleBounds.max[0] - visibleBounds.min[0]);
    const virtualUnitsPerScreenPixel = virtualWidth / bufferWidth;

    const numLods = availableScales.length;
    const lodShift = numLods - 1;
    const lodF = lodShift - Math.log2(1 / virtualUnitsPerScreenPixel);

    const maxLod = numLods - 1;
    const newLOD = Math.max(0, Math.min(maxLod, Math.floor(lodF)));

    if (newLOD !== this.currentLOD_) {
      console.log(`LOD changed from ${this.currentLOD_} to ${newLOD}`);
      this.currentLOD_ = newLOD;
    }
  }
}

export class ChunkManager {
  private readonly sources_ = new Map<ImageChunkSource, ChunkManagerSource>();

  public async addSource(source: ImageChunkSource) {
    let existing = this.sources_.get(source);
    if (!existing) {
      const loader = await source.open();
      const attrs = await loader.loadAttributes();
      existing = new ChunkManagerSource(loader, attrs);
      this.sources_.set(source, existing);
    }
    return existing;
  }

  public update(camera: Camera, bufferWidth: number, _bufferHeight: number) {
    const visibleBounds = this.computeVisibleBounds(camera);

    for (const [_, chunkManagerSource] of this.sources_) {
      chunkManagerSource.computeLOD(visibleBounds, bufferWidth);
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
