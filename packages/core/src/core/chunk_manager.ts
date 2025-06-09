import { Camera } from "../objects/cameras/camera";

export interface LODResult {
  // Optimal scale index to use (0 = highest resolution)
  scaleIndex: number;
  // Effective resolution in pixels per world unit
  resolution: number;
  // Scale factor for this level (physical units per pixel)
  scaleFactor: number;
}

export class ChunkManager {
  public getVisibleChunks() {
    // TODO: implement
  }

  public update(_camera: Camera, _bufferWidth: number, _bufferHeight: number) {
    // TODO: implement
  }

  public computeLOD(
    camera: Camera,
    bufferWidth: number, // screen/canvas width in pixels
    bufferHeight: number, // screen/canvas height in pixels
    availableScales: number[][] // scale factors per LOD, where each scale is [c, z, y, x]
  ): LODResult {
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
