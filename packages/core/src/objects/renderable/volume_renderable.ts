import { RenderableObject } from "../../core/renderable_object";
import { BoxGeometry } from "../geometry/box_geometry";
import { Texture } from "../textures/texture";

export class VolumeRenderable extends RenderableObject {
  constructor(texture: Texture) {
    super();
    this.geometry = new BoxGeometry(1, 1, 1, 1, 1, 1);
    this.setTexture(0, texture);
    this.programName = "volume";
  }

  public get type() {
    return "VolumeRenderable";
  }
}
