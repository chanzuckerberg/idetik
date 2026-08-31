import { Camera, CameraType, type CameraJSON } from "./camera";
import { glMatrix, mat4, vec3 } from "gl-matrix";

const DEFAULT_FOV = 60; // degrees
const DEFAULT_ASPECT_RATIO = 1.77; // 16:9
const MIN_FOV = 0.1; // degrees
const MAX_FOV = 180 - MIN_FOV; // degrees

export type PerspectiveCameraProps = {
  fov?: number;
  aspectRatio?: number;
  near?: number;
  far?: number;
  position?: vec3;
};

/** @group Cameras & Controls */
export class PerspectiveCamera extends Camera {
  private fov_: number;
  private aspectRatio_: number;

  constructor(props: PerspectiveCameraProps = {}) {
    const {
      fov = DEFAULT_FOV,
      aspectRatio = DEFAULT_ASPECT_RATIO,
      near = 0.1,
      far = 10000,
      position = vec3.fromValues(0, 0, 0),
    } = props;

    if (fov < MIN_FOV || fov > MAX_FOV) {
      throw new Error(
        `Invalid field of view: ${fov}, must be in [${MIN_FOV}, ${MAX_FOV}] degrees`
      );
    }
    super();
    this.fov_ = fov;
    this.aspectRatio_ = aspectRatio;
    this.near_ = near;
    this.far_ = far;

    this.transform.setTranslation(position);

    this.updateProjectionMatrix();
  }

  public setAspectRatio(aspectRatio: number) {
    this.aspectRatio_ = aspectRatio;
    this.updateProjectionMatrix();
  }

  public get type(): CameraType {
    return "PerspectiveCamera";
  }

  public get fov() {
    return this.fov_;
  }

  /** Returns the camera projection and transform as JSON-safe data. */
  public toJSON(): Extract<CameraJSON, { type: "PerspectiveCamera" }> {
    return {
      type: "PerspectiveCamera",
      fov: this.fov_,
      near: this.near_,
      far: this.far_,
      transform: this.transformToJSON(),
    };
  }

  /**
   * Restores a camera from {@link toJSON}.
   *
   * Restore the camera before constructing {@link OrbitControls}. Its
   * constructor replaces the camera transform using its radius, angles, and
   * target.
   */
  public static fromJSON(
    json: Extract<CameraJSON, { type: "PerspectiveCamera" }>
  ): PerspectiveCamera {
    const camera = new PerspectiveCamera(json);
    camera.applyTransformJSON(json.transform);
    return camera;
  }

  public zoom(factor: number) {
    if (factor <= 0) {
      throw new Error(`Invalid zoom factor: ${factor}`);
    }
    // clamp the field of view to prevent degenerate behavior
    this.fov_ = Math.max(MIN_FOV, Math.min(MAX_FOV, this.fov_ / factor));
    this.updateProjectionMatrix();
  }

  protected updateProjectionMatrix() {
    mat4.perspective(
      this.projectionMatrix_,
      glMatrix.toRadian(this.fov),
      this.aspectRatio_,
      this.near_,
      this.far_
    );
  }
}
