import { Layer } from "./layer";
import { IdetikContext } from "../idetik";

export class LayerManager {
  private readonly layers_: Layer[] = [];

  // TODO: Make this non-optional when react components use the Idetik Runtime
  private readonly context_?: IdetikContext;

  constructor(context?: IdetikContext) {
    this.context_ = context;
  }

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
    if (this.context_) {
      layer.onAttached(this.context_);
    }
  }
  public remove(index: number) {
    this.layers_.splice(index, 1);
  }

  public get layers() {
    return this.layers_;
  }
}
