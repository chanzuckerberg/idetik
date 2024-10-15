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
    console.debug("OrthographicCamera::setViewportAspectRatio", aspectRatio);
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
    // Assuming the camera frame covers the whole canvas and we want to maintain
    // aspect ratios of images and geometries in general, then we need to set
    // the frame and canvas aspect ratio together.
    // This also means that the parameter values of the orthographic camera are
    // effectively suggestive (i.e. they may change). The best we can do is guarantee
    // that the actual orthographic projection includes the frame.
    // Alternatively, we could letterbox the canvas itself, but that is rare in
    // most visualization applications.
    const width = this.right_ - this.left_;
    const height = this.top_ - this.bottom_;
    const frameAspectRatio = width / height;

    let horizontalScale = 1;
    let verticalScale = 1;
    // The viewport is wider than the frame, so scale the x-coordinates
    // of the frame.
    if (this.viewportAspectRatio_ > frameAspectRatio) {
      horizontalScale = this.viewportAspectRatio_ / frameAspectRatio;
      // The viewport is taller than the frame, so scale the y-coordinates
      // of the frame.
    } else {
      verticalScale = frameAspectRatio / this.viewportAspectRatio_;
    }
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
    console.debug(
      "OrthographicCamera::updateProjectionMatrix",
      this.projectionMatrix_
    );
  }
}
