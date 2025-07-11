import { RenderableObject } from "../../core/renderable_object";
import { Geometry } from "../../core/geometry";
import { Texture } from "../../objects/textures/texture";
import { Color } from "../../core/color";

export class LabelRenderable extends RenderableObject {
  private readonly colorCycle_: Color[];

  constructor(
    geometry: Geometry | null,
    texture: Texture | null = null,
    colorCycle: Color[],
  ) {
    super();
    if (geometry) {
      this.geometry = geometry;
    }
    if (texture) {
      this.addTexture(texture);
    }
    this.colorCycle_ = colorCycle;
    this.programName = "labelImage";
  }

  public get type() {
    return "LabelRenderable";
  }

  public getUniforms() {
    // TODO: assert that color cycle does not exceed max allowed length;
    return {
      "ColorCycle[0]": this.colorCycle_.map(c => c.rgb).flat(),
      ColorCycleLength: this.colorCycle_.length,
    };
  }
}
