import { Camera } from "./camera";
import { mat4 } from "gl-matrix";

export class OrthographicCamera extends Camera {
  private left_: number;
  private right_: number;
  private bottom_: number;
  private top_: number;

  constructor(
    left: number,
    right: number,
    bottom: number,
    top: number,
    near = 0.1,
    far = 100.0
  ) {
    super();

    this.left_ = left;
    this.right_ = right;
    this.bottom_ = bottom;
    this.top_ = top;
    this.near_ = near;
    this.far_ = far;

    this.updateProjectionMatrix();
  }

  public setFrame(left: number, right: number, bottom: number, top: number) {
    this.left_ = left;
    this.right_ = right;
    this.bottom_ = bottom;
    this.top_ = top;
  }

  public get type() {
    return "OrthographicCamera";
  }

  protected updateProjectionMatrix() {
    mat4.ortho(
      this.projectionMatrix_,
      this.left_,
      this.right_,
      this.bottom_,
      this.top_,
      this.near_,
      this.far_
    );
  }
}
