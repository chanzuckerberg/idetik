import { Layer } from "./layer";
import { IdetikContext } from "../idetik";

export class LayerManager {
  private readonly layers_: Layer[] = [];
  private layersSnapshot_: Layer[] | null = null;
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
    this.layers_.push(layer);
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
    this.layers_.splice(index, 1);
    this.notifyLayersChanged();
  }

  public removeByIndex(index: number) {
    this.layers_.splice(index, 1);
    this.notifyLayersChanged();
  }

  public removeAll() {
    this.layers_.length = 0;
    this.notifyLayersChanged();
  }

  public get layers(): readonly Layer[] {
    return this.layers_;
  }

  private notifyLayersChanged(): void {
    this.layersSnapshot_ = null;
    for (const callback of this.callbacks_) {
      callback();
    }
  }

  addCallback = (callback: () => void): (() => void) => {
    this.callbacks_.push(callback);
    return () => {
      this.removeCallback(callback);
    };
  };

  public removeCallback(callback: () => void): void {
    const index = this.callbacks_.indexOf(callback);
    if (index === undefined) {
      throw new Error(`Callback to remove not found: ${callback}`);
    }
    this.callbacks_.splice(index, 1);
  }

  public getSnapshot(): Layer[] {
    if (this.layersSnapshot_ === null) {
      this.layersSnapshot_ = [...this.layers_];
    }
    return this.layersSnapshot_;
  }
}
