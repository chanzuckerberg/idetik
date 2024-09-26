import { RenderableObject } from "core/renderable_object";
import { mat4 } from "gl-matrix";

export abstract class Camera extends RenderableObject {
  protected projectionMatrix_ = mat4.create();
  protected near_ = 0;
  protected far_ = 0;

  protected abstract updateProjectionMatrix(): void;

  public get type() {
    return "Camera";
  }

  public update() {
    this.updateProjectionMatrix();
  }

  get projectionMatrix() {
    return this.projectionMatrix_;
  }
}
