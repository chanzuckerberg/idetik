import { vec3 } from "gl-matrix";
import { OrthographicCamera } from "./orthographic_camera";
import { CameraControls, PanZoomControls } from "./controls";
import { EventContext } from "../../core/event_dispatcher";
import {
  SliceCoordinatesXY,
  SliceCoordinatesXZ,
  SliceCoordinatesYZ,
} from "../../data/chunk";

/**
 * Configuration for linked orthoslice controls
 */
export type LinkedOrthoSliceConfig = {
  cameraXY: OrthographicCamera;
  cameraXZ: OrthographicCamera;
  cameraYZ: OrthographicCamera;
  sliceCoordsXY: SliceCoordinatesXY;
  sliceCoordsXZ: SliceCoordinatesXZ;
  sliceCoordsYZ: SliceCoordinatesYZ;
  linkZoom?: boolean; // Default: false
  onSliceChange?: () => void; // Called when slices are updated from camera panning
};

/**
 * Camera controls that link three orthogonal viewports for coordinated orthoslice navigation.
 *
 * This class coordinates pan and zoom interactions across XY, XZ, and YZ orthogonal viewports.
 * When panning in one viewport, the camera position updates trigger corresponding slice
 * position updates in the perpendicular viewports, creating a unified multi-view experience.
 *
 * Example:
 * - Panning in XY view (moving left/right and up/down) updates:
 *   - X coordinate in sliceCoordsYZ (moves the YZ slice plane)
 *   - Y coordinate in sliceCoordsXZ (moves the XZ slice plane)
 *
 * Zoom linking is optional and can be enabled to synchronize zoom levels across all three
 * orthogonal viewports.
 */
export class LinkedOrthoSliceControls implements CameraControls {
  // Internal wrapped controls for each viewport
  private readonly controlsXY_: PanZoomControls;
  private readonly controlsXZ_: PanZoomControls;
  private readonly controlsYZ_: PanZoomControls;

  // Camera references
  private readonly cameraXY_: OrthographicCamera;
  private readonly cameraXZ_: OrthographicCamera;
  private readonly cameraYZ_: OrthographicCamera;

  // Slice coordinate references
  private readonly sliceCoordsXY_: SliceCoordinatesXY;
  private readonly sliceCoordsXZ_: SliceCoordinatesXZ;
  private readonly sliceCoordsYZ_: SliceCoordinatesYZ;

  // State management
  private isUpdating_ = false; // Prevents circular updates
  private previousPositions_: {
    xy: vec3;
    xz: vec3;
    yz: vec3;
  };
  private previousScales_: {
    xy: number;
    xz: number;
    yz: number;
  };
  private previousSliceCoords_: {
    x: number;
    y: number;
    z: number;
  };
  private linkZoom_: boolean;
  private onSliceChange_?: () => void;

  constructor(config: LinkedOrthoSliceConfig) {
    // Store camera references
    this.cameraXY_ = config.cameraXY;
    this.cameraXZ_ = config.cameraXZ;
    this.cameraYZ_ = config.cameraYZ;

    // Store slice coordinate references
    this.sliceCoordsXY_ = config.sliceCoordsXY;
    this.sliceCoordsXZ_ = config.sliceCoordsXZ;
    this.sliceCoordsYZ_ = config.sliceCoordsYZ;

    // Create internal controls for each camera
    this.controlsXY_ = new PanZoomControls(this.cameraXY_);
    this.controlsXZ_ = new PanZoomControls(this.cameraXZ_);
    this.controlsYZ_ = new PanZoomControls(this.cameraYZ_);

    // Initialize state
    this.linkZoom_ = config.linkZoom ?? false;
    this.onSliceChange_ = config.onSliceChange;
    this.previousPositions_ = {
      xy: vec3.clone(this.cameraXY_.transform.translation),
      xz: vec3.clone(this.cameraXZ_.transform.translation),
      yz: vec3.clone(this.cameraYZ_.transform.translation),
    };
    this.previousScales_ = {
      xy: this.getCameraScale_(this.cameraXY_),
      xz: this.getCameraScale_(this.cameraXZ_),
      yz: this.getCameraScale_(this.cameraYZ_),
    };
    this.previousSliceCoords_ = {
      x: this.sliceCoordsYZ_.x,
      y: this.sliceCoordsXZ_.y,
      z: this.sliceCoordsXY_.z,
    };
  }

  /**
   * Create a viewport-specific controls instance that only updates its own camera.
   * Use this to avoid routing all events to all cameras.
   */
  public createViewportControls(viewport: "xy" | "xz" | "yz"): CameraControls {
    return {
      onEvent: (event: EventContext) => {
        this.onEventForViewport(event, viewport);
      },
    };
  }

  /**
   * Handle events from a specific viewport.
   */
  private onEventForViewport(
    event: EventContext,
    viewport: "xy" | "xz" | "yz"
  ): void {
    const control =
      viewport === "xy"
        ? this.controlsXY_
        : viewport === "xz"
          ? this.controlsXZ_
          : this.controlsYZ_;
    const camera =
      viewport === "xy"
        ? this.cameraXY_
        : viewport === "xz"
          ? this.cameraXZ_
          : this.cameraYZ_;

    // Store previous state before event
    const prevPos = vec3.clone(camera.transform.translation);
    const prevScale = this.getCameraScale_(camera);

    // Route event to the specific control only
    control.onEvent(event);

    // Detect changes
    const posChanged = !vec3.equals(prevPos, camera.transform.translation);
    const scaleChanged = prevScale !== this.getCameraScale_(camera);

    // Sync slices if position changed
    if (posChanged) {
      const xyMoved = viewport === "xy";
      const xzMoved = viewport === "xz";
      const yzMoved = viewport === "yz";

      this.syncSlicesFromCameraPositions_(xyMoved, xzMoved, yzMoved);

      // Update all camera positions to match the new slice coordinates
      this.syncAllCamerasFromSlices_();

      this.updatePreviousPositions_();
      this.onSliceChange_?.();
    }

    // Sync zoom if enabled and scale changed
    if (this.linkZoom_ && scaleChanged) {
      // Calculate the zoom factor that was applied (inverse of scale ratio)
      const currentScale = this.getCameraScale_(camera);
      const zoomFactor = prevScale / currentScale;

      // Apply same zoom to the other two cameras
      if (viewport !== "xy") this.cameraXY_.zoom(zoomFactor);
      if (viewport !== "xz") this.cameraXZ_.zoom(zoomFactor);
      if (viewport !== "yz") this.cameraYZ_.zoom(zoomFactor);

      this.updatePreviousScales_();
    }
  }

  /**
   * Handle events from any of the three orthogonal viewports.
   * Routes events to the appropriate internal control and synchronizes
   * slice positions and zoom levels as needed.
   *
   * @deprecated Use createViewportControls() instead for better per-viewport control
   */
  public onEvent(event: EventContext): void {
    // Store previous positions and scales before event
    const prevPosXY = vec3.clone(this.cameraXY_.transform.translation);
    const prevPosXZ = vec3.clone(this.cameraXZ_.transform.translation);
    const prevPosYZ = vec3.clone(this.cameraYZ_.transform.translation);
    const prevScaleXY = this.getCameraScale_(this.cameraXY_);
    const prevScaleXZ = this.getCameraScale_(this.cameraXZ_);
    const prevScaleYZ = this.getCameraScale_(this.cameraYZ_);

    // Route event to all three controls (only the active viewport will respond)
    this.controlsXY_.onEvent(event);
    this.controlsXZ_.onEvent(event);
    this.controlsYZ_.onEvent(event);

    // Detect position changes and sync slices
    const posChangedXY = !vec3.equals(
      prevPosXY,
      this.cameraXY_.transform.translation
    );
    const posChangedXZ = !vec3.equals(
      prevPosXZ,
      this.cameraXZ_.transform.translation
    );
    const posChangedYZ = !vec3.equals(
      prevPosYZ,
      this.cameraYZ_.transform.translation
    );

    if (posChangedXY || posChangedXZ || posChangedYZ) {
      this.syncSlicesFromCameraPositions_(
        posChangedXY,
        posChangedXZ,
        posChangedYZ
      );
      this.updatePreviousPositions_();
      // Notify that slices changed
      this.onSliceChange_?.();
    }

    // Detect zoom changes and sync if linking is enabled
    const scaleChangedXY = prevScaleXY !== this.getCameraScale_(this.cameraXY_);
    const scaleChangedXZ = prevScaleXZ !== this.getCameraScale_(this.cameraXZ_);
    const scaleChangedYZ = prevScaleYZ !== this.getCameraScale_(this.cameraYZ_);

    // Count how many cameras zoomed
    const numZoomed = [scaleChangedXY, scaleChangedXZ, scaleChangedYZ].filter(
      Boolean
    ).length;

    // Only sync zoom if linking is enabled AND exactly one camera zoomed
    // (If multiple zoomed, they all received the same event, so don't sync)
    if (this.linkZoom_ && numZoomed === 1) {
      this.syncZoomLevels_(
        prevScaleXY,
        prevScaleXZ,
        prevScaleYZ,
        scaleChangedXY,
        scaleChangedXZ,
        scaleChangedYZ
      );
      this.updatePreviousScales_();
    }
  }

  /**
   * Set the X slice position. Updates slice coordinates and moves cameras.
   */
  public setSliceX(x: number): void {
    if (this.isUpdating_) return;
    this.isUpdating_ = true;

    try {
      this.sliceCoordsYZ_.x = x;

      // Update XY camera X position
      const [, yXY, zXY] = this.cameraXY_.transform.translation;
      this.cameraXY_.transform.setTranslation([x, yXY, zXY]);

      // Update XZ camera X position
      const [, yXZ, zXZ] = this.cameraXZ_.transform.translation;
      this.cameraXZ_.transform.setTranslation([x, yXZ, zXZ]);

      this.previousSliceCoords_.x = x;
      this.updatePreviousPositions_();
      this.onSliceChange_?.();
    } finally {
      this.isUpdating_ = false;
    }
  }

  /**
   * Set the Y slice position. Updates slice coordinates and moves cameras.
   */
  public setSliceY(y: number): void {
    if (this.isUpdating_) return;
    this.isUpdating_ = true;

    try {
      this.sliceCoordsXZ_.y = y;

      // Update XY camera Y position
      const [xXY, , zXY] = this.cameraXY_.transform.translation;
      this.cameraXY_.transform.setTranslation([xXY, y, zXY]);

      // Update YZ camera Y position
      const [xYZ, , zYZ] = this.cameraYZ_.transform.translation;
      this.cameraYZ_.transform.setTranslation([xYZ, y, zYZ]);

      this.previousSliceCoords_.y = y;
      this.updatePreviousPositions_();
      this.onSliceChange_?.();
    } finally {
      this.isUpdating_ = false;
    }
  }

  /**
   * Set the Z slice position. Updates slice coordinates and moves cameras.
   */
  public setSliceZ(z: number): void {
    if (this.isUpdating_) return;
    this.isUpdating_ = true;

    try {
      this.sliceCoordsXY_.z = z;

      // Update XZ camera Z position
      const [xXZ, yXZ] = this.cameraXZ_.transform.translation;
      this.cameraXZ_.transform.setTranslation([xXZ, yXZ, z]);

      // Update YZ camera Z position
      const [xYZ, yYZ] = this.cameraYZ_.transform.translation;
      this.cameraYZ_.transform.setTranslation([xYZ, yYZ, z]);

      this.previousSliceCoords_.z = z;
      this.updatePreviousPositions_();
      this.onSliceChange_?.();
    } finally {
      this.isUpdating_ = false;
    }
  }

  /**
   * Enable or disable zoom linking across the three orthogonal viewports.
   * When enabled, zooming in one viewport will apply the same zoom factor
   * to the other two viewports.
   */
  public setZoomLinking(enabled: boolean): void {
    this.linkZoom_ = enabled;
    if (enabled) {
      this.updatePreviousScales_();
    }
  }

  /**
   * Get the current zoom linking state.
   */
  public get linkZoom(): boolean {
    return this.linkZoom_;
  }

  /**
   * Set the zoom linking state (for GUI binding).
   */
  public set linkZoom(enabled: boolean) {
    this.setZoomLinking(enabled);
  }

  /**
   * Synchronize all camera positions to match current slice coordinates.
   */
  private syncAllCamerasFromSlices_(): void {
    if (this.isUpdating_) return;

    const x = this.sliceCoordsYZ_.x;
    const y = this.sliceCoordsXZ_.y;
    const z = this.sliceCoordsXY_.z;

    // Update all camera positions to match slice coordinates
    // XY camera: X and Y match slices, Z is unchanged (camera is outside the volume)
    const [, , zXY] = this.cameraXY_.transform.translation;
    this.cameraXY_.transform.setTranslation([x, y, zXY]);

    // XZ camera: X and Z match slices, Y is unchanged
    const [, yXZ] = this.cameraXZ_.transform.translation;
    this.cameraXZ_.transform.setTranslation([x, yXZ, z]);

    // YZ camera: Y and Z match slices, X is unchanged
    const [xYZ] = this.cameraYZ_.transform.translation;
    this.cameraYZ_.transform.setTranslation([xYZ, y, z]);
  }

  /**
   * Synchronize slice coordinates from camera positions.
   * This is called after a pan event to update the perpendicular slice positions.
   * Only updates coordinates for the cameras that actually moved.
   */
  private syncSlicesFromCameraPositions_(
    xyMoved: boolean,
    xzMoved: boolean,
    yzMoved: boolean
  ): void {
    if (this.isUpdating_) return;
    this.isUpdating_ = true;

    try {
      // Extract camera positions
      const [xXY, yXY] = this.cameraXY_.transform.translation;
      const [xXZ, , zXZ] = this.cameraXZ_.transform.translation;
      const [, yYZ, zYZ] = this.cameraYZ_.transform.translation;

      // Only update slice coordinates from cameras that moved
      // XY camera controls X and Y coordinates
      if (xyMoved) {
        this.sliceCoordsYZ_.x = xXY;
        this.sliceCoordsXZ_.y = yXY;
        this.previousSliceCoords_.x = xXY;
        this.previousSliceCoords_.y = yXY;
      }

      // XZ camera controls X and Z coordinates
      if (xzMoved) {
        this.sliceCoordsYZ_.x = xXZ;
        this.sliceCoordsXY_.z = zXZ;
        this.previousSliceCoords_.x = xXZ;
        this.previousSliceCoords_.z = zXZ;
      }

      // YZ camera controls Y and Z coordinates
      if (yzMoved) {
        this.sliceCoordsXZ_.y = yYZ;
        this.sliceCoordsXY_.z = zYZ;
        this.previousSliceCoords_.y = yYZ;
        this.previousSliceCoords_.z = zYZ;
      }
    } finally {
      this.isUpdating_ = false;
    }
  }

  /**
   * Synchronize zoom levels across the three orthogonal viewports.
   * Applies the zoom factor from the active viewport to the other two.
   */
  private syncZoomLevels_(
    prevScaleXY: number,
    prevScaleXZ: number,
    prevScaleYZ: number,
    scaleChangedXY: boolean,
    scaleChangedXZ: boolean,
    scaleChangedYZ: boolean
  ): void {
    if (this.isUpdating_) return;
    this.isUpdating_ = true;

    try {
      let zoomFactor = 1.0;

      // Determine which viewport changed and calculate zoom factor
      if (scaleChangedXY) {
        const currentScale = this.getCameraScale_(this.cameraXY_);
        zoomFactor = currentScale / prevScaleXY;
      } else if (scaleChangedXZ) {
        const currentScale = this.getCameraScale_(this.cameraXZ_);
        zoomFactor = currentScale / prevScaleXZ;
      } else if (scaleChangedYZ) {
        const currentScale = this.getCameraScale_(this.cameraYZ_);
        zoomFactor = currentScale / prevScaleYZ;
      }

      // Apply zoom factor to the other two viewports
      if (scaleChangedXY) {
        this.cameraXZ_.zoom(zoomFactor);
        this.cameraYZ_.zoom(zoomFactor);
      } else if (scaleChangedXZ) {
        this.cameraXY_.zoom(zoomFactor);
        this.cameraYZ_.zoom(zoomFactor);
      } else if (scaleChangedYZ) {
        this.cameraXY_.zoom(zoomFactor);
        this.cameraXZ_.zoom(zoomFactor);
      }
    } finally {
      this.isUpdating_ = false;
    }
  }

  /**
   * Get the effective scale of a camera's view.
   * For orthographic cameras, zoom is applied via transform scale.
   * We use the X scale component as the zoom level indicator.
   */
  private getCameraScale_(camera: OrthographicCamera): number {
    return camera.transform.scale[0];
  }

  /**
   * Update stored previous positions for change detection.
   */
  private updatePreviousPositions_(): void {
    vec3.copy(this.previousPositions_.xy, this.cameraXY_.transform.translation);
    vec3.copy(this.previousPositions_.xz, this.cameraXZ_.transform.translation);
    vec3.copy(this.previousPositions_.yz, this.cameraYZ_.transform.translation);
  }

  /**
   * Update stored previous scales for change detection.
   */
  private updatePreviousScales_(): void {
    this.previousScales_.xy = this.getCameraScale_(this.cameraXY_);
    this.previousScales_.xz = this.getCameraScale_(this.cameraXZ_);
    this.previousScales_.yz = this.getCameraScale_(this.cameraYZ_);
  }
}
