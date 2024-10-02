import { RenderableObject } from "./renderable_object";

type LayerState = "initialized" | "loading" | "ready";

export abstract class Layer {
  private objects_: RenderableObject[] = [];
  protected state_: LayerState = "initialized";

  public abstract update(): void;

  public get objects() {
    return this.objects_;
  }

  public get state() {
    return this.state_;
  }

  protected addObject(object: RenderableObject) {
    this.objects_.push(object);
  }

  protected clearObjects() {
    this.objects_ = [];
  }
}
