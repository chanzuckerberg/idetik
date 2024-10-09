import { mat4, vec3 } from "gl-matrix";

export class AffineTransform {
  private dirty_ = true;
  private matrix_ = mat4.create();
  private inverse_: mat4 | null = null;
  private translation_ = vec3.create();

  public translate(vec: vec3) {
    vec3.add(this.translation_, this.translation_, vec);
    this.dirty_ = true;
  }

  // TODO: add scale

  // TODO: add rotate

  public get matrix() {
    if (this.dirty_) {
      this.matrix_ = mat4.create();
      mat4.translate(this.matrix_, this.matrix_, this.translation_);
      this.inverse_ = null;
      this.dirty_ = false;
    }
    this.inverse_ = mat4.invert(mat4.create(), this.matrix_);
    return this.matrix_;
  }

  public get inverse() {
    if (this.inverse_ === null) {
      this.inverse_ = mat4.invert(mat4.create(), this.matrix);
    }
    return this.inverse_;
  }
}
