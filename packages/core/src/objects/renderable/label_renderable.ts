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
  constructor(
    geometry: Geometry,
    texture: Texture,
    colorCycle: Color[],
    colorOverrides: Map<number, Color>
  ) {
    super();
    this.geometry = geometry;
    this.addTexture(texture);
    const colorOverridesTexture = this.makeColorOverrideTexture(colorOverrides);
    this.addTexture(colorOverridesTexture);
    const colorCycleTexture = this.makeColorCycleTexture(colorCycle);
    this.addTexture(colorCycleTexture);
  }

  public get type() {
    return "LabelRenderable";
  }

  public addTexture(texture: Texture) {
    super.addTexture(texture);
    this.setProgramName();
  }

  public getUniforms() {
    return {
      texture0: 0,
      texture1: 1,
      texture2: 2,
    };
  }

  private makeColorCycleTexture(colorCycle: Color[]) {
    const data = new Uint32Array(colorCycle.map((c) => c.toPacked()));
    const texture = new Texture2D(data, data.length, 1);
    texture.unpackRowLength = data.length;
    texture.unpackAlignment = 4;
    texture.wrapR = "repeat";
    texture.wrapS = "repeat";
    texture.wrapT = "repeat";
    texture.needsUpdate = true;
    return texture;
  }

  private makeColorOverrideTexture(colorOverrides: Map<number, Color>) {
    const keys = Array.from(colorOverrides.keys());
    const values = Array.from(colorOverrides.values()).map((c) => c.toPacked());
    const numColors = colorOverrides.size;
    const data = new Uint32Array(numColors * 2);
    data.set(keys, 0);
    data.set(values, numColors);
    const texture = new Texture2D(data, numColors, 2);
    texture.unpackRowLength = numColors;
    texture.unpackAlignment = 4;
    texture.wrapR = "clamp_to_edge";
    texture.wrapS = "clamp_to_edge";
    texture.wrapT = "clamp_to_edge";
    texture.needsUpdate = true;
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
