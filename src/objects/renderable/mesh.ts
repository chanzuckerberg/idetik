import { RenderableObject } from "core/renderable_object";
import { Geometry } from "core/geometry";
import { Texture } from "objects/textures/texture";

export class Mesh extends RenderableObject {
  private contrastLimits_: [number, number];

  constructor(
    geometry: Geometry | null,
    texture: Texture | null = null,
    contrastLimits?: [number, number]
  ) {
    super();

    if (geometry) {
      this.geometry = geometry;
    }

    if (texture) {
      this.addTexture(texture);
    }

    this.contrastLimits_ = this.validateContrastLimits(contrastLimits);
  }

  public get contrastLimits() {
    return this.contrastLimits_;
  }

  public setContrastLimits(contrastLimits: [number, number] | undefined) {
    this.contrastLimits_ = this.validateContrastLimits(contrastLimits);
  }

  private validateContrastLimits(
    contrastLimits: [number, number] | undefined
  ): [number, number] {
    if (contrastLimits !== undefined) {
      if (contrastLimits[1] <= contrastLimits[0]) {
        throw new Error(
          `Contrast limits must be strictly increasing: ${contrastLimits}.`
        );
      }
      return contrastLimits;
    }
    const texture = this.textures[0];
    if (!texture) return [0, 1];
    if (texture.dataFormat === "rgb" || texture.dataFormat === "rgba")
      return [0, 1];
    switch (texture.dataType) {
      case "unsigned_byte":
        return [0, 255];
      case "unsigned_short":
        return [0, 65535];
      case "float":
        return [0, 1];
    }
  }

  public get type() {
    return "Mesh";
  }
}
