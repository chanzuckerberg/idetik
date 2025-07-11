import { RenderableObject } from "../../core/renderable_object";
import { Geometry } from "../../core/geometry";
import { Texture } from "../../objects/textures/texture";
import { Color } from "../../core/color";

export class LabelRenderable extends RenderableObject {
  private readonly colorCycle_: Color[];
  private readonly colorOverrides_: Map<number, Color>;

  constructor(
    geometry: Geometry | null,
    texture: Texture | null = null,
    colorCycle: Color[],
    colorOverrides: Map<number, Color>
  ) {
    super();
    if (geometry) {
      this.geometry = geometry;
    }
    if (texture) {
      this.addTexture(texture);
    }
    this.colorCycle_ = colorCycle;
    console.debug("colorOverrides", colorOverrides);
    this.colorOverrides_ = colorOverrides;
    this.programName = "labelImage";
  }

  public get type() {
    return "LabelRenderable";
  }

  public getUniforms() {
    // TODO: assert that color arrays does not exceed max allowed length;
    return {
      "ColorCycle[0]": this.colorCycle_.map((c) => c.rgba).flat(),
      ColorCycleLength: this.colorCycle_.length,
      "ColorOverridesKeys[0]": Array.from(this.colorOverrides_.keys()),
      "ColorOverridesValues[0]": Array.from(this.colorOverrides_.values())
        .map((c) => c.rgba)
        .flat(),
      ColorOverridesLength: this.colorOverrides_.size,
    };
  }
}
