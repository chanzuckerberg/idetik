import { RenderableObject } from "../../core/renderable_object";
import { Geometry } from "../../core/geometry";
import { Texture } from "../../objects/textures/texture";
import { Color } from "../../core/color";
import { Shader } from "../../renderers/shaders";
import { TextureDataType } from "../textures/texture";

const dataTypeToProgramName: Map<TextureDataType, Shader> = new Map([
  ["byte", "intLabelImage"],
  ["int", "intLabelImage"],
  ["short", "intLabelImage"],
  ["unsigned_byte", "uintLabelImage"],
  ["unsigned_int", "uintLabelImage"],
  ["unsigned_short", "uintLabelImage"],
]);

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
    this.colorOverrides_ = colorOverrides;
  }

  public get type() {
    return "LabelRenderable";
  }

  public addTexture(texture: Texture) {
    super.addTexture(texture);
    this.setProgramName();
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

  private setProgramName() {
    const texture = this.textures[0];
    if (!texture) {
      throw new Error("un-textured label image not implemented");
    }
    const programName = dataTypeToProgramName.get(texture.dataType);
    if (programName === undefined) {
      throw new Error(
        `Unsupported label texture data type: ${texture.dataType}.`
      );
    }
    this.programName = programName;
  }
}
