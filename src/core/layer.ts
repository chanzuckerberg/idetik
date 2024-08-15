import { RenderableObject } from "./renderable_object";

export abstract class Layer {
  private objects_: RenderableObject[] = [];

  public get objects() {
    return this.objects_;
  }

  protected addObject(object: RenderableObject) {
    this.objects_.push(object);
  }
}
