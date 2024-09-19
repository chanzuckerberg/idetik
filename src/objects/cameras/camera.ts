import { RenderableObject } from "../../core/renderable_object";
import { mat4 } from "gl-matrix";

export abstract class Camera extends RenderableObject {
  protected projectionTransform_ = mat4.create();
  protected viewTransform_ = mat4.create();

  protected abstract updateProjectionTransform(): void;

  constructor() {
    super();
    this.updateProjectionTransform();
  }

  public get type() {
    return "Camera";
  }

  public updateTransforms() {
    this.updateProjectionTransform();
  }

  get projectionTransform() {
    return this.projectionTransform_;
  }

  get viewTransform() {
    return this.viewTransform_;
  }
}
