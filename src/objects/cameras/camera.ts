import { RenderableObject } from "core/renderable_object";
import { mat4 } from "gl-matrix";

export abstract class Camera extends RenderableObject {
  protected projectionTransform_ = mat4.create();
  protected near_ = 0;
  protected far_ = 0;

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
    return this.transform.matrix;
  }
}
