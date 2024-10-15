import { Camera } from "./camera";
import { mat4 } from "gl-matrix";

export class OrthographicCamera extends Camera {
  private left_: number;
  private right_: number;
  private bottom_: number;
  private top_: number;
  private viewportAspectRatio_: number = 1;

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

  public setViewportAspectRatio(aspectRatio: number) {
    this.viewportAspectRatio_ = aspectRatio;
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
    // The following code ensures that the orthographic projection matrix
    // is updated so that the aspect ratio of renderable objects is respected
    // (e.g. image pixels are isotropic).
    const width = this.right_ - this.left_;
    const height = this.top_ - this.bottom_;
    const frameAspectRatio = width / height;

    // When the viewport is wider than the frame, scale the x-coordinates
    // of this camera's frame to define the orthographic projection.
    // Otherwise, scale the y-coordinates of the frame.
    let horizontalScale = 1;
    let verticalScale = 1;
    if (this.viewportAspectRatio_ > frameAspectRatio) {
      horizontalScale = this.viewportAspectRatio_ / frameAspectRatio;
    } else {
      verticalScale = frameAspectRatio / this.viewportAspectRatio_;
    }
    // Ensure this camera's frame remains centered in the viewport.
    const horizontalCenter = 0.5 * (this.left_ + this.right_);
    const verticalCenter = 0.5 * (this.bottom_ + this.top_);
    const halfWidth = 0.5 * width;
    const halfHeight = 0.5 * height;
    mat4.ortho(
      this.projectionMatrix_,
      horizontalCenter - horizontalScale * halfWidth,
      horizontalCenter + horizontalScale * halfWidth,
      -(verticalCenter - verticalScale * halfHeight),
      -(verticalCenter + verticalScale * halfHeight),
      this.near_,
      this.far_
    );
  }
}
