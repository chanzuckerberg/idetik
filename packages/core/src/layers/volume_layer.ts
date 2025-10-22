import { Layer } from "../core/layer";
import { VolumeRenderable } from "../objects/renderable/volume_renderable";

export class VolumeLayer extends Layer {
  public readonly type = "VolumeLayer";

  constructor() {
    super();

    const renderable = new VolumeRenderable();
    renderable.wireframeEnabled = true;

    this.addObject(renderable);
    this.setState("ready");
  }

  public update() {
    // TODO: implement
  }
}
