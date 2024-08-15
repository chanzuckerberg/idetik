import { RenderableObject } from "core/renderable_object";

export abstract class Layer {
  private objects_: RenderableObject[] = [];

  public get objects() {
    return this.objects_;
  }
}
