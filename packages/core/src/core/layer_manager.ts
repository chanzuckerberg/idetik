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

    // Sort layers by zIndex:
    // - Opaque: front-to-back (ascending) to optimize early depth rejection
    // - Transparent: back-to-front (descending) to ensure correct alpha compositing
    opaque.sort((a, b) => a.zIndex - b.zIndex);
    transparent.sort((a, b) => b.zIndex - a.zIndex);

    return { opaque, transparent };
  }

  public add(layer: Layer) {
    this.layers_.push(layer);
  }

  public get layers() {
    return this.layers_;
  }
}
