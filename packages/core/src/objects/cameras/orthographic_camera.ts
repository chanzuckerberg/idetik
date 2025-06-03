import { Camera } from "./camera";
import { mat4 } from "gl-matrix";

const DEFAULT_ASPECT_RATIO = 1.77; // 16:9
const DEFAULT_WIDTH = 128;
const DEFAULT_HEIGHT = 128 / DEFAULT_ASPECT_RATIO;

export class OrthographicCamera extends Camera {
  // width_ and height_ should always be defined by constructor (see setFrame)
  private width_: number = DEFAULT_WIDTH;
  private height_: number = DEFAULT_HEIGHT;
  private viewportAspectRatio_: number = DEFAULT_ASPECT_RATIO;

  constructor(
    left: number,
    right: number,
    top: number,
    bottom: number,
    near = 0.0,
    far = 100.0
  ) {
    super();
    this.near_ = near;
    this.far_ = far;
    this.setFrame(left, right, bottom, top);
    this.updateProjectionMatrix();
  }

  public setAspectRatio(aspectRatio: number) {
    this.viewportAspectRatio_ = aspectRatio;
    this.updateProjectionMatrix();
  }

  public setFrame(left: number, right: number, bottom: number, top: number) {
    this.width_ = Math.abs(right - left);
    this.height_ = Math.abs(top - bottom);
    this.updateProjectionMatrix();
    const centerX = 0.5 * (left + right);
    const centerY = 0.5 * (bottom + top);
    this.transform.setTranslation([centerX, centerY, 0]);
    this.transform.setScale([1, 1, 1]);
    this.transform.setRotation([0, 0, 0, 1]);
  }

  public get type() {
    return "OrthographicCamera";
  }

  public zoom(factor: number) {
    if (factor <= 0) {
      throw new Error(`Invalid zoom factor: ${factor}`);
    }
    const inverseFactor = 1.0 / factor;
    this.transform.addScale([inverseFactor, inverseFactor, 1.0]);
  }

  protected updateProjectionMatrix() {
    // The following code ensures that the orthographic projection matrix
    // is updated so that the aspect ratio of renderable objects is respected
    // (e.g. image pixels are isotropic) by padding the camera frame to form
    // the viewport frame.
    const width = this.width_;
    const height = this.height_;
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
    mat4.ortho(
      this.projectionMatrix_,
      -viewportHalfWidth,
      viewportHalfWidth,
      -viewportHalfHeight,
      viewportHalfHeight,
      this.near_,
      this.far_
    );
  }
}
