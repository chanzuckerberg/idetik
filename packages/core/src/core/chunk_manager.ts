import {
  ImageChunk,
  ImageChunkLoader,
  ImageChunkSource,
  LoaderAttributes,
} from "@/data/image_chunk";
import { Region } from "@/data/region";

import { Camera } from "../objects/cameras/camera";
import { vec4, mat4 } from "gl-matrix";

export class ChunkManagerSource {
  private readonly loader_: ImageChunkLoader;
  private readonly chunks_: ImageChunk[][] = [];
  private readonly attributes_: LoaderAttributes[];
  private region_?: Region;
  private currentLOD_: number;
  private lastErrorTime_ = 0;
  private readonly ERROR_THROTTLE_MS_ = 5000; // Only log errors every 5 seconds

  constructor(loader: ImageChunkLoader, attributes: LoaderAttributes[]) {
    this.loader_ = loader;
    this.attributes_ = attributes;
    this.currentLOD_ = this.attributes_.length - 1; // default to lowest res
  }

  public setRegion(region: Region) {
    this.region_ = region;
  }

  public async updateLOD(camera: Camera, bufferWidth: number) {
    const availableScales = this.attributes_.map((attr) => attr.scale);

    if (availableScales.length === 0) {
      // No scales available, just ensure chunk is loaded at current LOD
      await this.loadChunk();
      return;
    }

    const lodResult = this.computeLOD(camera, bufferWidth, availableScales);
    const lodChanged = lodResult !== this.currentLOD_;

    if (lodChanged) {
      console.log(`LOD changed from ${this.currentLOD_} to ${lodResult}`);
      this.currentLOD_ = lodResult;
    }

    await this.loadChunk();
  }

  public getVisibleChunks(): ImageChunk[] {
    if (!this.region_) {
      return [];
    }
    return this.chunks_[this.currentLOD_] || [];
  }

  public async loadChunk(): Promise<void> {
    if (!this.region_) {
      return;
    }

    // Check if already cached
    if (this.chunks_[this.currentLOD_]?.length > 0) {
      return;
    }

    try {
      const chunk = await this.loader_.loadChunk(
        this.region_,
        this.currentLOD_
      );
      this.chunks_[this.currentLOD_] = [chunk];
    } catch (error) {
      // Throttle error logging to prevent console spam in render loop
      const now = Date.now();
      if (now - this.lastErrorTime_ > this.ERROR_THROTTLE_MS_) {
        console.warn("Failed to load chunk:", error);
        this.lastErrorTime_ = now;
      }
    }
  }

  private computeLOD(
    camera: Camera,
    bufferWidth: number, // screen/canvas width in pixels
    availableScales: number[][] // scale factors per LOD, where each scale is [c, z, y, x]
  ): number {
    // Get the actual visible bounds to determine virtual width
    const viewExtent = this.calculateVisibleBounds(camera);
    const virtualWidth = viewExtent.worldWidth;
    const virtualUnitsPerScreenPixel = virtualWidth / bufferWidth;

    const numLods = availableScales.length;
    const lodShift = numLods - 1;
    const lodF = lodShift - Math.log2(1 / virtualUnitsPerScreenPixel);

    const maxLod = numLods - 1;
    const result = Math.max(0, Math.min(maxLod, Math.floor(lodF)));

    return result;
  }

  // Calculate the visible bounds in virtual space.
  private calculateVisibleBounds(camera: Camera): {
    worldWidth: number;
    worldHeight: number;
  } {
    // Screen space corners (normalized device coordinates: -1 to +1)
    const topLeftNDC = vec4.fromValues(-1, 1, 0, 1);
    const bottomRightNDC = vec4.fromValues(1, -1, 0, 1);

    // Compute inverse view-projection matrix once
    const viewProjection = mat4.multiply(
      mat4.create(),
      camera.projectionMatrix,
      camera.viewMatrix
    );
    const invViewProjection = mat4.invert(mat4.create(), viewProjection);

    // Transform to world space
    const topLeftWorld = vec4.transformMat4(
      vec4.create(),
      topLeftNDC,
      invViewProjection
    );
    const bottomRightWorld = vec4.transformMat4(
      vec4.create(),
      bottomRightNDC,
      invViewProjection
    );

    const worldWidth = Math.abs(bottomRightWorld[0] - topLeftWorld[0]);
    const worldHeight = Math.abs(topLeftWorld[1] - bottomRightWorld[1]);

    return { worldWidth, worldHeight };
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

  public async update(camera: Camera, bufferWidth: number) {
    for (const source of this.sources_.values()) {
      await source.updateLOD(camera, bufferWidth);
    }
  }
}
