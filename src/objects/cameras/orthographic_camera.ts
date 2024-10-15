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
    console.debug("OrthographicCamera::setAspectRatio: ", aspectRatio, this.left_, this.right_, this.bottom_, this.top_);
    // When aspect ratio of canvas is wide, maintain horizontal center.
    if (aspectRatio > 1) {
      const height = this.top_ - this.bottom_;
      const halfWidth = 0.5 * (aspectRatio * height);
      const horizontalCenter = 0.5 * (this.right_ + this.left_);
      this.left_ = horizontalCenter - halfWidth;
      this.right_ = horizontalCenter + halfWidth;
    // When aspect ratio of canvas is tall, maintain vertical center.
    } else if (aspectRatio < 1) {
      const width = this.right_ - this.left_;
      const halfHeight = 0.5 * (width / aspectRatio);
      const verticalCenter = 0.5 * (this.top_ + this.bottom_);
      this.bottom_ = verticalCenter - halfHeight;
      this.top_ = verticalCenter + halfHeight;
    }
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
    // Assuming the camera frame covers the whole canvas and we want to maintain
    // aspect ratios of images and geometries in general, then we need to set
    // the frame and canvas aspect ratio together.
    // This also means that the parameter values of the orthographic camera are
    // suggestive (i.e. they may change).
    // Alternatively, we could letterbox the canvas itself, but that is rare in
    // most visualization applications.
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
