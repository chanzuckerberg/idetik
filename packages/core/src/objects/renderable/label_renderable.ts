import { RenderableObject } from "../../core/renderable_object";
import { Geometry } from "../../core/geometry";
import { Texture } from "../../objects/textures/texture";
import { Color } from "../../core/color";
import { Shader } from "../../renderers/shaders";
import { TextureDataType } from "../textures/texture";
import { Texture2D } from "../textures/texture_2d";

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
  private colorOverridesTexture_: Texture2D;

  constructor(
    geometry: Geometry,
    texture: Texture,
    colorCycle: Color[],
    colorOverrides: Map<number, Color>
  ) {
    super();
    this.geometry = geometry;
    this.addTexture(texture);
    this.colorCycle_ = colorCycle;
    this.colorOverrides_ = colorOverrides;
    this.colorOverridesTexture_ = this.makeColorOverrideTexture();
    this.addTexture(this.colorOverridesTexture_);
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
      texture0: 0,
      texture1: 1,
      "ColorCycle[0]": this.colorCycle_.map((c) => c.rgba).flat(),
      ColorCycleLength: this.colorCycle_.length,
    };
  }

  private makeColorOverrideTexture() {
    const keys = Array.from(this.colorOverrides_.keys());
    const values = Array.from(this.colorOverrides_.values()).map((c) =>
      c.toPacked()
    );
    console.log("keys:", keys);
    console.log("values:", values);
    const numColors = this.colorOverrides_.size;
    const data = new Uint32Array(numColors * 2);
    data.set(keys, 0);
    data.set(values, numColors);
    const texture = new Texture2D(data, numColors, 2);
    texture.unpackRowLength = numColors;
    texture.unpackAlignment = 1;
    texture.wrapR = "clamp_to_edge";
    texture.wrapS = "clamp_to_edge";
    texture.wrapT = "clamp_to_edge";
    texture.needsUpdate = true;
    console.log("texture:", texture);
    return texture;
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
