import { RenderableObject } from "core/renderable_object";
import { mat4 } from "gl-matrix";

export abstract class Camera extends RenderableObject {
  protected projectionTransform_ = mat4.create();

  protected abstract updateProjectionTransform(): void;

  constructor() {
    super();
    this.updateProjectionTransform();
  }

  public get type() {
    return "Camera";
  }

  get projectionTransform() {
    return this.projectionTransform_;
  }
}
