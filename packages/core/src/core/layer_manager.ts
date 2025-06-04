import { Layer } from "./layer";

export class LayerManager {
  private layers_: Layer[] = [];

  public partitionLayers(): {
    opaque: Layer[];
    transparent: Layer[];
  } {
    const opaque: Layer[] = [];
    const transparent: Layer[] = [];

    for (const layer of this.layers) {
      if (layer.transparent) {
        transparent.push(layer);
      } else {
        opaque.push(layer);
      }
    }

    return { opaque, transparent };
  }

  public add(layer: Layer) {
    this.layers_.push(layer);
  }
  public remove(index: number) {
    this.layers_.splice(index, 1);
  }

  public get layers() {
    return this.layers_;
  }
}
