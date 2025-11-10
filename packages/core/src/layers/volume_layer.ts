import { Layer } from "../core/layer";
import { Texture3D } from "../objects/textures/texture_3d";
import { VolumeRenderable } from "../objects/renderable/volume_renderable";

export class VolumeLayer extends Layer {
  public readonly type = "VolumeLayer";

  constructor() {
    super();

    const data = new Uint8Array([127, 0, 0, 127, 127, 0, 0, 127]);
    const texture = new Texture3D(data, 2, 2, 2);
    texture.unpackAlignment = 1;
    const renderable = new VolumeRenderable(1, 1, 1, texture);
    renderable.wireframeEnabled = true;

    this.addObject(renderable);
    this.setState("ready");
  }

  public update() {
    // TODO: implement
  }
}
