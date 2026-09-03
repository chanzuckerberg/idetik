import { Node } from "../../core/node";
import { Frustum } from "../../math/frustum";
import { TrsTransform } from "../../math/transforms";
import { mat4, vec3, vec4 } from "gl-matrix";

/** Identifies a concrete camera implementation. */
export type CameraType = "OrthographicCamera" | "PerspectiveCamera";

/**
 * Abstract base class for cameras.
 *
 * A camera pairs a world-space transform with a projection, producing the
 * view and projection matrices used to render a viewport. The concrete
 * cameras, {@link OrthographicCamera} and {@link PerspectiveCamera}, define
 * the projection. This class provides the shared transform, derived
 * matrices, and navigation helpers.
 *
 * @group Cameras
 */
export abstract class Camera extends Node {
  private readonly transform_ = new TrsTransform();
  /** @hidden */
  protected projectionMatrix_ = mat4.create();
  /** @hidden */
  protected near_ = 0;
  /** @hidden */
  protected far_ = 0;

  /** @hidden */
  protected abstract updateProjectionMatrix(): void;

  /** Identifies the camera type. */
  public abstract get type(): CameraType;

  /** Recomputes the camera's projection matrix. */
  public update() {
    this.updateProjectionMatrix();
  }

  /** The camera's projection matrix. */
  get projectionMatrix() {
    return this.projectionMatrix_;
  }

  /** The camera's world-space transform. */
  public get transform() {
    return this.transform_;
  }

  /** The view matrix: the inverse of the camera's world transform. */
  get viewMatrix() {
    return this.transform.inverse;
  }

  /** The camera's local right axis in world space. */
  get right() {
    const m = this.transform.matrix;
    return vec3.fromValues(m[0], m[1], m[2]);
  }

  /** The camera's local up axis in world space. */
  get up() {
    const m = this.transform.matrix;
    return vec3.fromValues(m[4], m[5], m[6]);
  }

  /**
   * Computes the combined view-projection matrix.
   *
   * @returns The projection matrix multiplied by the view matrix.
   */
  public getViewProjection(): mat4 {
    return mat4.multiply(mat4.create(), this.projectionMatrix, this.viewMatrix);
  }

  /** The view frustum derived from the current view-projection. */
  get frustum() {
    return new Frustum(this.getViewProjection());
  }

  /**
   * Sets the aspect ratio (width / height) of the viewport the camera
   * renders into. Called automatically by the owning viewport when it
   * resizes.
   *
   * @param aspectRatio - The viewport's width divided by its height.
   */
  public abstract setAspectRatio(aspectRatio: number): void;

  /**
   * Zooms the view by the given factor relative to the current zoom level.
   * Factors greater than `1` zoom in and factors between `0` and `1` zoom
   * out.
   *
   * @param factor - The magnification factor to apply.
   */
  public abstract zoom(factor: number): void;

  /**
   * Moves the camera by the given world-space offset.
   *
   * @param vec - The translation to add to the camera's position.
   */
  public pan(vec: vec3) {
    this.transform.addTranslation(vec);
  }

  /** The camera's world-space position. */
  public get position() {
    return this.transform.translation;
  }

  /**
   * Transforms a position from clip space to world space.
   *
   * @param position - The clip-space position to transform.
   * @returns The corresponding world-space position.
   */
  public clipToWorld(position: vec3): vec3 {
    const clipPos = vec4.fromValues(position[0], position[1], position[2], 1);
    const projectionInverse = mat4.invert(
      mat4.create(),
      this.projectionMatrix_
    )!;
    const viewPos = vec4.transformMat4(
      vec4.create(),
      clipPos,
      projectionInverse
    );
    vec4.scale(viewPos, viewPos, 1 / viewPos[3]);
    // the camera transform is *not* inverted here because we use the inverse when rendering
    const worldPos = vec4.transformMat4(
      vec4.create(),
      viewPos,
      this.transform.matrix
    );
    return vec3.fromValues(worldPos[0], worldPos[1], worldPos[2]);
  }
}
