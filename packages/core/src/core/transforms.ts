import { mat4, vec3, quat } from "gl-matrix";

export class SrtTransform {
  private dirty_ = true;
  private matrix_ = mat4.create();
  private rotation_ = quat.create();
  private translation_ = vec3.create();
  private scale_ = vec3.fromValues(1, 1, 1);

  public addRotation(q: quat) {
    quat.multiply(this.rotation_, this.rotation_, q);
    this.dirty_ = true;
  }

  public setRotation(q: quat) {
    quat.copy(this.rotation_, q);
    this.dirty_ = true;
  }

  public get rotation() {
    return quat.clone(this.rotation_);
  }

  public addTranslation(vec: vec3) {
    vec3.add(this.translation_, this.translation_, vec);
    this.dirty_ = true;
  }

  public setTranslation(vec: vec3) {
    vec3.copy(this.translation_, vec);
    this.dirty_ = true;
  }

  public get translation() {
    return vec3.clone(this.translation_);
  }

  public addScale(vec: vec3) {
    vec3.multiply(this.scale_, this.scale_, vec);
    this.dirty_ = true;
  }

  public setScale(vec: vec3) {
    vec3.copy(this.scale_, vec);
    this.dirty_ = true;
  }

  public get scale() {
    return vec3.clone(this.scale_);
  }

  public get matrix() {
    if (this.dirty_) {
      this.computeMatrix();
      this.dirty_ = false;
    }
    return this.matrix_;
  }

  public get inverse() {
    return mat4.invert(mat4.create(), this.matrix);
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
