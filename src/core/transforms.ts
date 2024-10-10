import { mat4, vec3, quat } from "gl-matrix";

export class AffineTransform {
  private dirtyMatrix_ = true;
  private dirtyInverse_ = true;
  private matrix_ = mat4.create();
  private inverse_ = mat4.create();
  private rotation_ = quat.create();
  private translation_ = vec3.create();
  private scale_ = vec3.fromValues(1, 1, 1);

  public rotate(q: quat) {
    quat.multiply(this.rotation_, this.rotation_, q);
    vec3.transformQuat(this.translation_, this.translation_, q);
    this.dirtyMatrix_ = true;
  }

  public translate(vec: vec3) {
    vec3.add(this.translation_, this.translation_, vec);
    this.dirtyMatrix_ = true;
  }

  public scale(vec: vec3) {
    vec3.multiply(this.scale_, this.scale_, vec);
    vec3.multiply(this.translation_, this.translation_, vec);
    this.dirtyMatrix_ = true;
  }

  public get matrix() {
    if (this.dirtyMatrix_) {
      mat4.fromRotationTranslationScale(
        this.matrix_,
        this.rotation_,
        this.translation_,
        this.scale_
      );
      this.dirtyMatrix_ = false;
      this.dirtyInverse_ = true;
    }
    return this.matrix_;
  }

  public get inverse() {
    if (this.dirtyMatrix_ || this.dirtyInverse_) {
      mat4.invert(this.inverse_, this.matrix);
      this.dirtyInverse_ = false;
    }
    return this.inverse_;
  }
}
