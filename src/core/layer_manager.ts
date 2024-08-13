import { Layer } from "core/layer";

export class LayerManager {
  private layers_: Layer[] = [];

  public add(layer: Layer) {
    this.layers_.push(layer);
  }
}
