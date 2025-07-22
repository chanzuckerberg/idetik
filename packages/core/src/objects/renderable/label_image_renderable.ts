import { RenderableObject } from "../../core/renderable_object";
import { Geometry } from "../../core/geometry";
import { Texture } from "../../objects/textures/texture";
import { Color } from "../../core/color";
import { Texture2D } from "../textures/texture_2d";

type LabelImageRenderableProps = {
  geometry: Geometry;
  texture: Texture;
  colorCycle: ReadonlyArray<Color>;
};

export class LabelImageRenderable extends RenderableObject {
  constructor(props: LabelImageRenderableProps) {
    super();
    this.geometry = props.geometry;
    this.addTexture(props.texture);
    const colorCycleTexture = this.makeColorCycleTexture(props.colorCycle);
    this.addTexture(colorCycleTexture);
    this.programName = "labelImage";
  }

  public get type() {
    return "LabelImageRenderable";
  }

  public getUniforms() {
    return {
      ImageData: 0,
      ColorCycle: 1,
    };
  }

  private makeColorCycleTexture(colorCycle: ReadonlyArray<Color>) {
    const data = new Uint32Array(colorCycle.map((c) => c.packed));
    const texture = new Texture2D(data, data.length, 1);
    texture.unpackRowLength = data.length;
    texture.unpackAlignment = 4;
    // const data = new Uint8Array(
    //   colorCycle.flatMap((c) => c.rgba).map((v) => Math.round(v * 255))
    // );
    // const texture = new Texture2D(data, colorCycle.length, 1);
    // texture.dataFormat = "rgba";
    // texture.unpackRowLength = data.length;
    // texture.unpackAlignment = 1;
    texture.wrapR = "repeat";
    texture.wrapS = "repeat";
    texture.wrapT = "repeat";
    texture.needsUpdate = true;
    return texture;
  }
}
