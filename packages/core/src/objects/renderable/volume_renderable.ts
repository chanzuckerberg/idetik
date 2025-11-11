import { RenderableObject } from "../../core/renderable_object";
import { BoxGeometry } from "../geometry/box_geometry";

export class VolumeRenderable extends RenderableObject {
  constructor() {
    super();
    this.geometry = new BoxGeometry(1, 1, 1, 1, 1, 1);
    this.cullFaceMode = "back";
    this.programName = "volume";
  }

  public get type() {
    return "VolumeRenderable";
  }
}
