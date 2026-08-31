import { Camera, CameraType, type CameraJSON } from "./camera";
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

export type OrthographicCameraFrame = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type OrthographicCameraProps = OrthographicCameraFrame & {
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
  private axes_: SliceAxes;
  private rotation_: quat;
  private orientation_: SliceOrientation;

  /**
   * Creates an orthographic camera framing the given world-space rectangle.
   *
   * @param props - The view frame edges in world units, near/far clipping
   *   plane distances (default `-1e6` and `1e6`), and the slice orientation
   *   the camera faces (default `"XY"`).
   */
  constructor(props: OrthographicCameraProps) {
    super();
    this.near_ = props.near ?? DEFAULT_NEAR;
    this.far_ = props.far ?? DEFAULT_FAR;
    this.orientation_ = props.orientation ?? "XY";
    this.axes_ = sliceAxesFor(this.orientation_);
    this.rotation_ = orientationRotation(this.axes_);
    this.setFrame(props);
    this.updateProjectionMatrix();
  }

  public get viewportSize() {
    return this.viewportSize_;
  }

  public setAspectRatio(aspectRatio: number) {
    this.viewportAspectRatio_ = aspectRatio;
    this.updateProjectionMatrix();
  }

  public setFrame({ left, right, top, bottom }: OrthographicCameraFrame) {
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

  public get orientation(): SliceOrientation {
    return this.orientation_;
  }

  /** Returns the camera projection and transform as JSON-safe data. */
  public toJSON(): Extract<CameraJSON, { type: "OrthographicCamera" }> {
    return {
      type: "OrthographicCamera",
      width: this.width_,
      height: this.height_,
      near: this.near_,
      far: this.far_,
      orientation: this.orientation_,
      transform: this.transformToJSON(),
    };
  }

  /** Restores a camera from {@link toJSON}. */
  public static fromJSON(
    json: Extract<CameraJSON, { type: "OrthographicCamera" }>
  ): OrthographicCamera {
    const camera = new OrthographicCamera({
      left: -json.width / 2,
      right: json.width / 2,
      top: -json.height / 2,
      bottom: json.height / 2,
      near: json.near,
      far: json.far,
      orientation: json.orientation,
    });
    camera.applyTransformJSON(json.transform);
    return camera;
  }

  /**
   * Changes the slice orientation the camera faces. The current frame and
   * zoom carry over numerically to the new plane axes. Call {@link setFrame}
   * to reframe the view for the new plane.
   */
  public setOrientation(orientation: SliceOrientation) {
    if (orientation === this.orientation_) {
      return;
    }

    const u = this.transform.translation[AxisComponent[this.axes_.u]];
    const v = this.transform.translation[AxisComponent[this.axes_.v]];

    this.orientation_ = orientation;
    this.axes_ = sliceAxesFor(orientation);
    this.rotation_ = orientationRotation(this.axes_);

    const translation = vec3.create();
    translation[AxisComponent[this.axes_.u]] = u;
    translation[AxisComponent[this.axes_.v]] = v;

    this.transform.setTranslation(translation);
    this.transform.setRotation(this.rotation_);
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
