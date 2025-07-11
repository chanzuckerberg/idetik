import { RenderableObject } from "../../core/renderable_object";
import { Geometry } from "../../core/geometry";
import { Texture } from "../../objects/textures/texture";

export class LabelRenderable extends RenderableObject {
  constructor(
    geometry: Geometry | null,
    texture: Texture | null = null,
  ) {
    super();
    if (geometry) {
      this.geometry = geometry;
    }
    if (texture) {
      this.addTexture(texture);
    }
    this.programName = "labelImage";
  }

  public get type() {
    return "LabelRenderable";
  }
}
