import { Layer, LayerOptions, RenderContext } from "../core/layer";

export type LayerViewProps = LayerOptions & {
  layers: Layer[];
  drawBounds?: boolean;
};

/**
 * LayerView is a composite layer that aggregates multiple child layers.
 * It forwards lifecycle methods and aggregates renderable objects from all children.
 * Useful for showing multiple layers in a single viewport (e.g., orthoslice views in 3D).
 */
export class LayerView extends Layer {
  public readonly type = "LayerView";

  private readonly layers_: Layer[];

  constructor({ layers, ...layerOptions }: LayerViewProps) {
    super(layerOptions);
    this.layers_ = layers;
    this.setState("ready");
  }

  public update(context?: RenderContext) {
    if (!context) return;

    // Aggregate renderable objects from all child layers
    this.clearObjects();
    this.layers_.forEach((layer) => {
      if (layer.state !== "ready") {
        return;
      }
      layer.objects.forEach((obj) => this.addObject(obj));
    });
    // TODO: optionally draw bounding boxes
  }
}
