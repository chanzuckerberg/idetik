import { Camera, CameraType } from "./camera";
import { quat, vec2, vec3, vec4, mat4 } from "gl-matrix";
import { Box2 } from "../../math/box2";
import {
  AxisComponent,
  SliceAxes,
  SliceOrientation,
  orientationRotation,
  sliceAxesFor,
} from "../../math/axes";

const DEFAULT_ASPECT_RATIO = 1.77; // 16:9
const DEFAULT_WIDTH = 128;
const DEFAULT_HEIGHT = 128 / DEFAULT_ASPECT_RATIO;
const DEFAULT_NEAR = -1e6;
const DEFAULT_FAR = 1e6;

type OrthographicCameraOptions = {
  near?: number;
  far?: number;
  orientation?: SliceOrientation;
};

/**
 * A camera using an orthographic (parallel) projection.
 *
 * Orthographic projection has no perspective foreshortening, so object size is
 * independent of distance from the camera. This is the camera to use for 2D
 * image viewing, where it pairs naturally with {@link PanZoomControls}. The
 * initial frame is given in world coordinates; zoom and pan are applied as
 * scale and translation on top of that frame.
 *
 * @see {@link PerspectiveCamera} for 3D scenes with perspective projection.
 *
 * @group Cameras & Controls
 */
export class OrthographicCamera extends Camera {
  // width_ and height_ should always be defined by constructor (see setFrame)
  private width_: number = DEFAULT_WIDTH;
  private height_: number = DEFAULT_HEIGHT;
  private viewportAspectRatio_: number = DEFAULT_ASPECT_RATIO;
  private viewportSize_: [number, number] = [DEFAULT_WIDTH, DEFAULT_HEIGHT];
  private readonly axes_: SliceAxes;
  private readonly rotation_: quat;

  /**
   * Creates an orthographic camera framing the given world-space rectangle.
   *
   * @param left - Left edge of the view frame, in world units.
   * @param right - Right edge of the view frame, in world units.
   * @param top - Top edge of the view frame, in world units.
   * @param bottom - Bottom edge of the view frame, in world units.
   * @param options - Near/far clipping plane distances (default `-1e6` and
   *   `1e6`) and the slice orientation the camera faces (default `"XY"`).
   */
  constructor(
    left: number,
    right: number,
    top: number,
    bottom: number,
    options: OrthographicCameraOptions = {}
  ) {
    super();
    this.near_ = options.near ?? DEFAULT_NEAR;
    this.far_ = options.far ?? DEFAULT_FAR;
    this.axes_ = sliceAxesFor(options.orientation ?? "XY");
    this.rotation_ = orientationRotation(this.axes_);
    this.setFrame(left, right, bottom, top);
    this.updateProjectionMatrix();
  }

  public get viewportSize() {
    return this.viewportSize_;
  }

  public setAspectRatio(aspectRatio: number) {
    this.viewportAspectRatio_ = aspectRatio;
    this.updateProjectionMatrix();
  }

  public setFrame(left: number, right: number, bottom: number, top: number) {
    this.width_ = Math.abs(right - left);
    this.height_ = Math.abs(top - bottom);
    this.updateProjectionMatrix();
    const translation = vec3.create();
    translation[AxisComponent[this.axes_.u]] = 0.5 * (left + right);
    translation[AxisComponent[this.axes_.v]] = 0.5 * (bottom + top);
    this.transform.setTranslation(translation);
    this.transform.setScale([1, 1, 1]);
    this.transform.setRotation(this.rotation_);
  }

  public get type(): CameraType {
    return "OrthographicCamera";
  }

  public zoom(factor: number) {
    if (factor <= 0) {
      throw new Error(`Invalid zoom factor: ${factor}`);
    }
    const inverseFactor = 1.0 / factor;
    this.transform.addScale([inverseFactor, inverseFactor, 1.0]);
  }

  public getWorldViewRect(): Box2 {
    let topLeft = vec4.fromValues(-1.0, -1.0, 0.0, 1.0);
    let bottomRight = vec4.fromValues(1.0, 1.0, 0.0, 1.0);

    const inv = mat4.invert(mat4.create(), this.getViewProjection())!;
    topLeft = vec4.transformMat4(vec4.create(), topLeft, inv);
    bottomRight = vec4.transformMat4(vec4.create(), bottomRight, inv);

    const u = AxisComponent[this.axes_.u];
    const v = AxisComponent[this.axes_.v];
    return new Box2(
      vec2.fromValues(topLeft[u], topLeft[v]),
      vec2.fromValues(bottomRight[u], bottomRight[v])
    );
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
    this.viewportSize_ = [2 * viewportHalfWidth, 2 * viewportHalfHeight];
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
