import { Box2 } from "@/math/box2";
import { Camera, CameraType } from "./camera";
import { glMatrix, mat4, vec2, vec3, vec4 } from "gl-matrix";

const DEFAULT_FOV = 60; // degrees
const DEFAULT_ASPECT_RATIO = 1.77; // 16:9
const MIN_FOV = 0.1; // degrees
const MAX_FOV = 180 - MIN_FOV; // degrees

type PerspectiveCameraOptions = {
  fov?: number;
  aspectRatio?: number;
  near?: number;
  far?: number;
  position?: vec3;
};

export class PerspectiveCamera extends Camera {
  private fov_: number;
  private aspectRatio_: number;

  constructor(options: PerspectiveCameraOptions = {}) {
    const {
      fov = DEFAULT_FOV,
      aspectRatio = DEFAULT_ASPECT_RATIO,
      near = 0.1,
      far = 10000,
      position = vec3.fromValues(0, 0, 0),
    } = options;

    if (fov < MIN_FOV || fov > MAX_FOV) {
      throw new Error(
        `Invalid field of view: ${fov}, must be in [${MIN_FOV}, ${MAX_FOV}] degrees`
      );
    }
    super();
    this.fov_ = fov;
    this.aspectRatio_ = aspectRatio;
    this.near_ = near;
    this.far_ = far;

    this.transform.setTranslation(position);

    this.updateProjectionMatrix();
  }

  public setAspectRatio(aspectRatio: number) {
    this.aspectRatio_ = aspectRatio;
    this.updateProjectionMatrix();
  }

  public get type(): CameraType {
    return "PerspectiveCamera";
  }

  public get fov() {
    return this.fov_;
  }

  public zoom(factor: number) {
    if (factor <= 0) {
      throw new Error(`Invalid zoom factor: ${factor}`);
    }
    // clamp the field of view to prevent degenerate behavior
    this.fov_ = Math.max(MIN_FOV, Math.min(MAX_FOV, this.fov_ / factor));
    this.updateProjectionMatrix();
  }

  protected updateProjectionMatrix() {
    mat4.perspective(
      this.projectionMatrix_,
      glMatrix.toRadian(this.fov),
      this.aspectRatio_,
      this.near_,
      this.far_
    );
  }

  public getWorldViewRect(distanceFromCamera?: number): Box2 {
    const distance =
      distanceFromCamera !== undefined ? distanceFromCamera : this.near_;

    const viewSpaceZ = -distance;

    // Z arrives in view-space, we convert it to NDC using the projection matrix.
    // NDC.z = (far+near)/(far-near) + (-2*far*near)/(far-near) * (1/view.z)
    const ndcZ =
      (this.far_ + this.near_) / (this.far_ - this.near_) +
      (-2 * this.far_ * this.near_) / (this.far_ - this.near_) / viewSpaceZ;

    // We create the corners of the NDC at the specified depth
    const ndcTopLeft = vec4.fromValues(-1.0, 1.0, ndcZ, 1.0);
    const ndcBottomRight = vec4.fromValues(1.0, -1.0, ndcZ, 1.0);

    // We transform from NDC to world space
    const viewProjection = mat4.multiply(
      mat4.create(),
      this.projectionMatrix,
      this.viewMatrix
    );

    const inv = mat4.invert(mat4.create(), viewProjection);
    const topLeft = vec4.transformMat4(vec4.create(), ndcTopLeft, inv);
    const bottomRight = vec4.transformMat4(vec4.create(), ndcBottomRight, inv);

    // Perspective divide
    vec4.scale(topLeft, topLeft, 1.0 / topLeft[3]);
    vec4.scale(bottomRight, bottomRight, 1.0 / bottomRight[3]);

    // We reorder min/max
    const minX = Math.min(topLeft[0], bottomRight[0]);
    const maxX = Math.max(topLeft[0], bottomRight[0]);
    const minY = Math.min(topLeft[1], bottomRight[1]);
    const maxY = Math.max(topLeft[1], bottomRight[1]);

    return new Box2(vec2.fromValues(minX, minY), vec2.fromValues(maxX, maxY));
  }
}
