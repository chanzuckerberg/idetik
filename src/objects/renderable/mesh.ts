import { RenderableObject } from "core/renderable_object";
import { Geometry } from "core/geometry";
import { Texture } from "objects/textures/texture";

export class Mesh extends RenderableObject {
  private contrastLimits_: [number, number];

  constructor(
    geometry: Geometry | null,
    texture: Texture | null = null,
    contrastLimits: [number, number] = [0, 255]
  ) {
    super();

    if (geometry) {
      this.geometry = geometry;
    }

    if (texture) {
      this.addTexture(texture);
    }

    this.contrastLimits_ = contrastLimits;
  }

  public get contrastLimits() {
    return this.contrastLimits_;
  }

  public get type() {
    return "Mesh";
  }
}
