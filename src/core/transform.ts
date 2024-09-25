import { vec3, mat4 } from "gl-matrix";

export class Transform {
  private dirty_ = true;
  private matrix_ = mat4.create();
  private position_ = vec3.create();

  public translate(axis: vec3, distance: number) {
    const v = vec3.scale(vec3.create(), axis, distance);
    vec3.add(this.position_, this.position_, v);
    this.dirty_ = true;
  }

  // TODO: add scale

  // TODO: add rotate

  public get matrix() {
    if (this.dirty_) {
      this.matrix_ = mat4.create();
      mat4.translate(this.matrix_, this.matrix_, this.position_);

      this.dirty_ = false;
    }
    return this.matrix_;
  }
}
