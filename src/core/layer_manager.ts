import { Layer } from "./layer";
import { RenderableObject } from "./renderable_object";

export class LayerManager {
  private layers_: Layer[] = [];

  public add(layer: Layer) {
    this.layers_.push(layer);
  }

  public get layers() {
    return this.layers_;
  }

  public get visibleObjects(): RenderableObject[] {
    const objects = [];
    for (const layer of this.layers_) {
      for (const object of layer.objects) {
        objects.push(object);
      }
    }
    return objects;
  }
}
