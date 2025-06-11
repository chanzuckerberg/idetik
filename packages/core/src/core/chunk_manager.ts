import {
  ImageChunk,
  ImageChunkLoader,
  ImageChunkSource,
  LoaderAttributes,
} from "@/data/image_chunk";
import { Region } from "@/data/region";

export interface LODResult {
  // Optimal scale index to use (0 = highest resolution)
  scaleIndex: number;
  // Effective resolution in pixels per world unit
  resolution: number;
  // Scale factor for this level (world units per pixel)
  scaleFactor: number;
}

import { Camera } from "../objects/cameras/camera";
import { vec2, vec4, mat4 } from "gl-matrix";

type Bounds = { min: vec2; max: vec2 };

export class ChunkManagerSource {
  private readonly loader_: ImageChunkLoader;
  private readonly attributes_: LoaderAttributes[];
  private region_?: Region;
  private currentLOD_?: LODResult;

  constructor(loader: ImageChunkLoader, attributes: LoaderAttributes[]) {
    this.loader_ = loader;
    this.attributes_ = attributes;
  }

  public setRegion(region: Region) {
    this.region_ = region;
  }

  public async load(): Promise<ImageChunk | undefined> {
    if (!this.region_) {
      return undefined;
    }

    // Use computed LOD if available; otherwise default to lowest resolution
    const lod = this.currentLOD_?.scaleIndex ?? this.attributes_.length - 1;

    return await this.loader_.loadChunk(this.region_, lod);
  }

  public async reloadWithScale(lod: number): Promise<ImageChunk | undefined> {
    if (!this.region_) {
      return undefined;
    }

    try {
      return await this.loader_.loadChunk(this.region_, lod);
    } catch (error) {
      console.warn("Failed to reload with new scale:", error);
      return undefined;
    }
  }

  public async getVisibleChunks(): Promise<ImageChunk[]> {
    if (!this.region_ || !this.currentLOD_) {
      return [];
    }
    const chunk = await this.loader_.loadChunk(this.region_, this.currentLOD_.scaleIndex);
    return [chunk];
  }

  public async updateLOD(camera: Camera, bufferWidth: number, bufferHeight: number): Promise<ImageChunk | undefined> {
    const availableScales = this.attributes_.map(attr => attr.scale);
    const lodResult = this.computeLOD(camera, bufferWidth, bufferHeight, availableScales);

    const lodChanged = !this.currentLOD_ || lodResult.scaleIndex !== this.currentLOD_.scaleIndex;

    if (lodChanged) {
      const oldLOD = this.currentLOD_?.scaleIndex ?? 'none';
      console.log(`LOD changed from ${oldLOD} to ${lodResult.scaleIndex} (resolution: ${lodResult.resolution.toFixed(2)}, scale factor: ${lodResult.scaleFactor.toFixed(4)})`);
      this.currentLOD_ = lodResult;
      return await this.reloadWithScale(lodResult.scaleIndex);
    }

    this.currentLOD_ = lodResult;
    return undefined;
  }

  public computeLOD(
    camera: Camera,
    bufferWidth: number, // screen/canvas width in pixels
    bufferHeight: number, // screen/canvas height in pixels
    availableScales: number[][] // scale factors per LOD, where each scale is [c, z, y, x]
  ): LODResult {
    // console.log("computeLOD", availableScales);
    if (availableScales.length === 0) {
      throw new Error("No scales available");
    }

    // Calculate world-space dimensions of the current visible view
    const viewExtent = this.calculateViewExtent(
      camera,
      bufferWidth,
      bufferHeight
    );

    // Calculate desired screen resolution: pixels per world unit
    // i.e., how many screen pixels span one unit of virtual space (zoom-dependent)
    const desiredResolutionX = bufferWidth / viewExtent.worldWidth;
    const desiredResolutionY = bufferHeight / viewExtent.worldHeight;

    // Choose the higher resolution between X and Y (higher pixels per unit) to avoid aliasing
    const desiredResolution = Math.max(desiredResolutionX, desiredResolutionY);

    // Select the LOD with resolution closest to what's needed - prefer higher resolution over lower resolution
    let bestScaleIndex = 0;
    let bestResolutionMatch = Infinity;

    for (let i = 0; i < availableScales.length; i++) {
      const scale = availableScales[i];

      // Assume last two dimensions are spatial (y, x) — scale = world units per texel
      const scaleX = scale[scale.length - 1];
      const scaleY = scale[scale.length - 2];

      // Convert resolution to texels per world unit
      // Higher = more detail; lower = coarser
      // Less than 1 texel per world unit = undersampling → aliasing risk
      const resolutionX = 1.0 / scaleX;
      const resolutionY = 1.0 / scaleY;
      const resolution = Math.min(resolutionX, resolutionY); // Conservative estimate

      const resolutionRatio = resolution / desiredResolution;

      // Scoring:
      // - If ratio >= 1.0 → oversampling → mildly penalize
      // - If ratio < 1.0 → undersampling → penalize more strongly
      let score: number;
      if (resolutionRatio >= 1.0) {
        // Resolution is higher than desired - score based on how much excess detail
        score = resolutionRatio;
      } else {
        // Resolution is lower than desired - penalize but not too harshly
        // Use 1/ratio so that the higher resolution ( that's closer to desired) gets better score
        score = 1.0 / resolutionRatio;
      }

      if (score < bestResolutionMatch) {
        bestResolutionMatch = score;
        bestScaleIndex = i;
      }
    }

    const selectedScale = availableScales[bestScaleIndex];
    const scaleX = selectedScale[selectedScale.length - 1];
    const scaleY = selectedScale[selectedScale.length - 2];
    const effectiveResolution = Math.min(1.0 / scaleX, 1.0 / scaleY);
    const effectiveScaleFactor = Math.max(scaleX, scaleY);

    return {
      scaleIndex: bestScaleIndex,
      resolution: effectiveResolution,
      scaleFactor: effectiveScaleFactor,
    };
  }

  // Calculate the world space extent (width/height) currently visible in the camera view.
  private calculateViewExtent(
    camera: Camera,
    _bufferWidth: number, // screen width
    _bufferHeight: number // screen height
  ): { worldWidth: number; worldHeight: number } {
    // Screen space corners (normalized device coordinates: -1 to +1)
    const topLeft = camera.clipToWorld([-1, 1, 0]); // camera space to world space
    const topRight = camera.clipToWorld([1, 1, 0]);
    const bottomLeft = camera.clipToWorld([-1, -1, 0]);
    const bottomRight = camera.clipToWorld([1, -1, 0]);

    // Calculate world space dimensions
    const worldWidth = Math.max(
      Math.abs(topRight[0] - topLeft[0]),
      Math.abs(bottomRight[0] - bottomLeft[0])
    );

    const worldHeight = Math.max(
      Math.abs(topLeft[1] - bottomLeft[1]),
      Math.abs(topRight[1] - bottomRight[1])
    );

    return { worldWidth, worldHeight };
  }

}

export class ChunkManager {
  private readonly sources_ = new Map<ImageChunkSource, ChunkManagerSource>();

  public computeVisibleBounds(camera: Camera): Bounds {
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

  public async addSource(source: ImageChunkSource) {
    let existing = this.sources_.get(source);
    if (!existing) {
      console.log("adding sourceq", source);
      const loader = await source.open();
      const attrs = await loader.loadAttributes();
      existing = new ChunkManagerSource(loader, attrs);
      this.sources_.set(source, existing);
      console.log("added source", source);
    }
    return existing;
  }

  public async update(camera: Camera, region: Region, bufferWidth: number, bufferHeight: number) {
    // const visibleBounds = this.computeVisibleBounds(camera);
    // Note: ChunkManager doesn't know about regions, so layers will call updateLOD directly
    // This is left here for future use when we implement proper chunk management
    for (const source of this.sources_.values()) {
      await source.updateLOD(camera, bufferWidth, bufferHeight, region);
    }
  }

}
