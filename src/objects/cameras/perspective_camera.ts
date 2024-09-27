import { Camera } from "./camera";
import { glMatrix, mat4 } from "gl-matrix";

const DEFAULT_FOV = 60; // degrees
const DEFAULT_ASPECT_RATIO = 1.77; // 16:9

export class PerspectiveCamera extends Camera {
  private fov_: number;
  private aspectRatio_: number;

  constructor(
    fov: number = DEFAULT_FOV,
    aspectRatio: number = DEFAULT_ASPECT_RATIO,
    near = 0.1,
    far = 1000.0
  ) {
    super();
    this.fov_ = fov;
    this.aspectRatio_ = aspectRatio;
    this.near_ = near;
    this.far_ = far;

    this.updateProjectionMatrix();
  }

  public setAspectRatio(aspectRatio: number) {
    this.aspectRatio_ = aspectRatio;
  }

  public get type() {
    return "PerspectiveCamera";
  }

  protected updateProjectionMatrix() {
    mat4.perspective(
      this.projectionMatrix_,
      glMatrix.toRadian(this.fov_),
      this.aspectRatio_,
      this.near_,
      this.far_
    );
  }
}
