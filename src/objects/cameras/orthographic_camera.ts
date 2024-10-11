import { Camera } from "./camera";
import { mat4 } from "gl-matrix";

export class OrthographicCamera extends Camera {
  private left_: number;
  private right_: number;
  private bottom_: number;
  private top_: number;
  private aspectRatio_: number = 1;

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

  public setAspectRatio(aspectRatio: number) {
    this.aspectRatio_ = aspectRatio;
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
    let xMult = 1;
    let yMult = 1;
    if (this.aspectRatio_ > 1) {
      xMult = this.aspectRatio_;
    } else {
      yMult = 1 / this.aspectRatio_;
    }
    mat4.ortho(
      this.projectionMatrix_,
      this.left_ * xMult,
      this.right_ * xMult,
      this.bottom_ * yMult,
      this.top_ * yMult,
      this.near_,
      this.far_
    );
  }
}
