import { vec3, mat4 } from "gl-matrix";

export class AffineTransform {
  private dirty_ = true;
  private matrix_ = mat4.create();
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

      this.dirty_ = false;
    }
    return this.matrix_;
  }
}
