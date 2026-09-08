import { mat4, mat3, vec3, quat, glMatrix } from "gl-matrix";

// +Y is world up to match gl-matrix
const WORLD_UP = vec3.fromValues(0, 1, 0);

/**
 * Transform defined by translation, rotation, and scale components.
 *
 * TRS transform represents a placement in world space composed as
 * translation times rotation times scale. It is used to position cameras
 * and renderable objects through their `transform` property. The matrix
 * is computed lazily and cached.
 *
 * ```ts
 * const transform = camera.transform;
 * transform.setTranslation([0, 0, radius]);
 * transform.targetTo([0, 0, 0]);
 * ```
 *
 * @group Math
 */
export class TrsTransform {
  private dirty_ = true;
  private matrix_ = mat4.create();
  private rotation_ = quat.create();
  private translation_ = vec3.create();
  private scale_ = vec3.fromValues(1, 1, 1);

  /**
   * Composes the given rotation onto the current rotation.
   *
   * @param q - The rotation to apply.
   */
  public addRotation(q: quat) {
    quat.multiply(this.rotation_, this.rotation_, q);
    this.dirty_ = true;
  }

  /**
   * Replaces the rotation with the given quaternion.
   *
   * @param q - The new rotation.
   */
  public setRotation(q: quat) {
    quat.copy(this.rotation_, q);
    this.dirty_ = true;
  }

  /** A copy of the rotation quaternion. */
  public get rotation() {
    return quat.clone(this.rotation_);
  }

  /**
   * Adds the given offset to the translation.
   *
   * @param vec - The offset to add.
   */
  public addTranslation(vec: vec3) {
    vec3.add(this.translation_, this.translation_, vec);
    this.dirty_ = true;
  }

  /**
   * Replaces the translation with the given vector.
   *
   * @param vec - The new translation.
   */
  public setTranslation(vec: vec3) {
    vec3.copy(this.translation_, vec);
    this.dirty_ = true;
  }

  /** A copy of the translation vector. */
  public get translation() {
    return vec3.clone(this.translation_);
  }

  /**
   * Multiplies the scale componentwise by the given vector.
   *
   * @param vec - The scale factors to apply.
   */
  public addScale(vec: vec3) {
    vec3.multiply(this.scale_, this.scale_, vec);
    this.dirty_ = true;
  }

  /**
   * Replaces the scale with the given vector.
   *
   * @param vec - The new scale.
   */
  public setScale(vec: vec3) {
    vec3.copy(this.scale_, vec);
    this.dirty_ = true;
  }

  /**
   * Rotates the transform to face the given target point. Uses `+Y` as
   * world up.
   *
   * @param target - The world-space point to face.
   */
  public targetTo(target: vec3) {
    // Prevent zero-length forward vector by nudging
    // target slightly along +Z
    if (vec3.equals(this.translation_, target)) {
      target = vec3.clone(target);
      target[2] += glMatrix.EPSILON;
    }

    const m = mat4.targetTo(mat4.create(), this.translation_, target, WORLD_UP);
    const rotation = mat3.fromMat4(mat3.create(), m);
    quat.fromMat3(this.rotation_, rotation);
    quat.normalize(this.rotation_, this.rotation_);

    this.dirty_ = true;
  }

  /** A copy of the scale vector. */
  public get scale() {
    return vec3.clone(this.scale_);
  }

  /** The composed transform matrix. Recomputed when stale. */
  public get matrix() {
    if (this.dirty_) {
      this.computeMatrix();
      this.dirty_ = false;
    }
    return this.matrix_;
  }

  /** The inverse of the composed transform matrix. */
  public get inverse() {
    return mat4.invert(mat4.create(), this.matrix)!;
  }

  private computeMatrix() {
    mat4.fromRotationTranslationScale(
      this.matrix_,
      this.rotation_,
      this.translation_,
      this.scale_
    );
  }
}
