import { Camera } from "./camera";
import { glMatrix, mat4, vec3 } from "gl-matrix";

const DEFAULT_FOV = 60; // degrees
const DEFAULT_ASPECT_RATIO = 1.77; // 16:9

type PerspectiveCameraOptions = {
  fov?: number;
  aspectRatio?: number;
  near?: number;
  far?: number;
  position?: vec3;
  target?: vec3;
};

export class PerspectiveCamera extends Camera {
  private fov_: number;
  private aspectRatio_: number;
  private position_: vec3;
  private target_: vec3;

  constructor(options: PerspectiveCameraOptions = {}) {
    const {
      fov = DEFAULT_FOV,
      aspectRatio = DEFAULT_ASPECT_RATIO,
      near = 0.1,
      far = 10000,
      position = vec3.create(),
      target = vec3.create(),
    } = options;

    if (fov <= 0 || fov >= 180) {
      throw new Error(`Invalid field of view: ${fov}`);
    }
    super();
    this.fov_ = fov;
    this.aspectRatio_ = aspectRatio;
    this.near_ = near;
    this.far_ = far;

    this.position_ = position;
    this.target_ = target;
    this.transform.setTranslation(position);
    this.transform.lookAt(target);

    this.updateProjectionMatrix();
  }

  public setAspectRatio(aspectRatio: number) {
    this.aspectRatio_ = aspectRatio;
  }

  public get type() {
    return "PerspectiveCamera";
  }

  public get fov() {
    return this.fov_;
  }

  public get effectiveFov() {
    return this.fov_ / this.zoom_;
  }

  public get position() {
    return this.position_;
  }

  public set position(position: vec3) {
    this.position_ = position;
    this.transform.setTranslation(position);
  }

  public get target() {
    return this.target_;
  }

  public set target(target: vec3) {
    this.target_ = target;
    this.transform.lookAt(target);
  }

  protected updateProjectionMatrix() {
    // clamp the field of view and zoom to prevent degenerate behavior
    const fov = Math.max(0.1, Math.min(179.9, this.fov_ / this.zoom_));
    this.zoom_ = this.fov_ / fov;
    mat4.perspective(
      this.projectionMatrix_,
      glMatrix.toRadian(fov),
      this.aspectRatio_,
      this.near_,
      this.far_
    );
  }
}
