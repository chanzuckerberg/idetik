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
      if (layer.isTransparent) {
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

  public get layers() {
    return this.layers_;
  }
}
