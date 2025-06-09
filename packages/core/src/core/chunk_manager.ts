import { Camera } from "../objects/cameras/camera";

export interface LODResult {
  /** Optimal scale index to use (0 = highest resolution) */
  scaleIndex: number;
  /** Effective resolution in pixels per world unit */
  resolution: number;
  /** Scale factor for this level (physical units per pixel) */
  scaleFactor: number;
}

export class ChunkManager {
  public getVisibleChunks() {
    // TODO: implement
  }

  public update(_camera: Camera, _bufferWidth: number, _bufferHeight: number) {
    // TODO: implement
  }

  /**
   * Compute the optimal Level of Detail (LOD) scale index based on camera view and screen resolution.
   *
   * The algorithm selects the scale level where approximately one data pixel maps to one screen pixel,
   * providing optimal visual quality without wasting bandwidth on imperceptible detail.
   *
   * @param camera - Current camera providing the view transformation
   * @param bufferWidth - Screen/canvas width in pixels
   * @param bufferHeight - Screen/canvas height in pixels
   * @param availableScales - Array of scale factors for each LOD level, where scales[0] is highest resolution
   * @param currentPosition - World position being viewed (defaults to camera center)
   * @returns LODResult with optimal scale index and resolution info
   */
  public computeLOD(
    camera: Camera,
    bufferWidth: number, // screen width
    bufferHeight: number, // screen height
    availableScales: number[][],
    _currentPosition?: [number, number]
  ): LODResult {
    if (availableScales.length === 0) {
      throw new Error("No scales available");
    }

    // Use camera center if no position specified
    // Future enhancement: could use _currentPosition for view-dependent LOD calculation

    // Calculate world space dimensions of the current view
    const viewExtent = this.calculateViewExtent(camera, bufferWidth, bufferHeight);

    // Calculate desired resolution: pixels per world unit
    // This represents how many screen pixels we want per world space unit
    const desiredResolutionX = bufferWidth / viewExtent.worldWidth;
    const desiredResolutionY = bufferHeight / viewExtent.worldHeight;

    // Use the more restrictive resolution (higher value = more detail needed)
    const desiredResolution = Math.max(desiredResolutionX, desiredResolutionY);

    // Find the scale that best matches our desired resolution
    let bestScaleIndex = 0;
    let bestResolutionMatch = Infinity;

    for (let i = 0; i < availableScales.length; i++) {
      const scale = availableScales[i];

      // Assume last two dimensions are X and Y (spatial dimensions)
      const scaleX = scale[scale.length - 1]; // X scale factor (world units per pixel)
      const scaleY = scale[scale.length - 2]; // Y scale factor (world units per pixel)

      // Convert to resolution: pixels per world unit
      const resolutionX = 1.0 / scaleX; // pixels/texel per world unit in X
      const resolutionY = 1.0 / scaleY; // pixels/texel per world unit in Y
      const resolution = Math.min(resolutionX, resolutionY); // Conservative estimate

      // Find scale that provides resolution closest to (but not less than) desired
      // Prefer slightly higher resolution over lower resolution
      const resolutionRatio = resolution / desiredResolution;

      // Score: prefer resolutions >= desired, but be reasonable about lower resolutions
      let score: number;
      if (resolutionRatio >= 1.0) {
        // Resolution is higher than desired - score based on how much excess detail
        score = resolutionRatio;
      } else {
        // Resolution is lower than desired - penalize but not too harshly
        // Use 1/ratio so higher resolution (closer to desired) gets better score
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

  /**
   * Calculate the world space extent (width/height) currently visible in the camera view.
   */
  private calculateViewExtent(
    camera: Camera,
    _bufferWidth: number, // screen width
    _bufferHeight: number // screen height
  ): { worldWidth: number; worldHeight: number } { // virtual world space extent
    // Convert screen corners to world coordinates to determine view extent

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
