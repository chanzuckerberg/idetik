import { Layer } from "./layer";
import { IdetikContext } from "../idetik";

export class LayerManager {
  private layers_: ReadonlyArray<Layer> = [];
  private callbacks_: Array<() => void> = [];

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
    this.layers_ = [...this.layers_, layer];
    if (this.context_) {
      layer.onAttached(this.context_);
    }
    this.notifyLayersChanged();
  }

  public remove(layer: Layer) {
    const index = this.layers_.indexOf(layer);
    if (index === -1) {
      throw new Error(`Layer to remove not found: ${layer}`);
    }
    this.removeByIndex(index);
  }

  public removeByIndex(index: number) {
    const layer = this.layers_[index];
    if (layer) {
      layer.onDetached();
    }
    this.layers_ = this.layers_.filter((_, i) => i !== index);
    this.notifyLayersChanged();
  }

  public removeAll() {
    for (const layer of this.layers_) {
      layer.onDetached();
    }
    this.layers_ = [];
    this.notifyLayersChanged();
  }

  public get layers(): readonly Layer[] {
    return this.layers_;
  }

  private notifyLayersChanged(): void {
    for (const callback of this.callbacks_) {
      callback();
    }
  }

  public addLayersChangeCallback(callback: () => void): () => void {
    this.callbacks_.push(callback);
    return () => {
      this.removeLayersChangeCallback(callback);
    };
  }

  public removeLayersChangeCallback(callback: () => void): void {
    const index = this.callbacks_.indexOf(callback);
    if (index === undefined) {
      throw new Error(`Callback to remove not found: ${callback}`);
    }
    this.callbacks_.splice(index, 1);
  }
}
