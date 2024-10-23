import { Camera } from "./camera";
import { mat4 } from "gl-matrix";

export class OrthographicCamera extends Camera {
  // TODO: store width and height instead?
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
    near = 0,
    far = 100.0
  ) {
    super();

    // this keeps the camera frame centered at the origin
    // use camera.pan or set its *position* (this.transform) to move the center
    const halfWidth = Math.abs(right - left);
    const halfHeight = Math.abs(top - bottom);
    const centerX = 0.5 * (left + right);
    const centerY = 0.5 * (bottom + top);
    this.transform.setTranslation([centerX, centerY, 0]);
    this.left_ = -halfWidth;
    this.right_ = halfWidth;
    this.bottom_ = -halfHeight;
    this.top_ = halfHeight;

    this.near_ = near;
    this.far_ = far;

    this.updateProjectionMatrix();
  }

  public setViewportAspectRatio(aspectRatio: number) {
    this.viewportAspectRatio_ = aspectRatio;
  }

  public setFrame(left: number, right: number, bottom: number, top: number) {
    const halfWidth = Math.abs(right - left);
    const halfHeight = Math.abs(top - bottom);
    const centerX = 0.5 * (left + right);
    const centerY = 0.5 * (bottom + top);
    this.transform.setTranslation([centerX, centerY, 0]);
    this.left_ = -halfWidth;
    this.right_ = halfWidth;
    this.bottom_ = -halfHeight;
    this.top_ = halfHeight;
    this.zoom_ = 1.0;
  }

  public get type() {
    return "OrthographicCamera";
  }

  protected updateProjectionMatrix() {
    // The following code ensures that the orthographic projection matrix
    // is updated so that the aspect ratio of renderable objects is respected
    // (e.g. image pixels are isotropic) by padding the camera frame to form
    // the viewport frame.
    const width = (this.right_ - this.left_) / this.zoom_;
    const height = (this.top_ - this.bottom_) / this.zoom_;
    const frameAspectRatio = width / height;
    // When the viewport is wider than the camera frame, add horizontal
    // padding such that the height is unchanged. Otherwise, add vertical
    // padding such that the width is unchanged.
    let viewportHalfWidth = 0.5 * width;
    let viewportHalfHeight = 0.5 * height;
    if (this.viewportAspectRatio_ > frameAspectRatio) {
      viewportHalfWidth *= this.viewportAspectRatio_ / frameAspectRatio;
    } else {
      viewportHalfHeight *= frameAspectRatio / this.viewportAspectRatio_;
    }
    // Center the camera frame in the padded viewport frame.
    const horizontalCenter = 0.5 * (this.left_ + this.right_);
    const verticalCenter = 0.5 * (this.bottom_ + this.top_);
    mat4.ortho(
      this.projectionMatrix_,
      horizontalCenter - viewportHalfWidth,
      horizontalCenter + viewportHalfWidth,
      verticalCenter - viewportHalfHeight,
      verticalCenter + viewportHalfHeight,
      this.near_,
      this.far_
    );
  }
}
