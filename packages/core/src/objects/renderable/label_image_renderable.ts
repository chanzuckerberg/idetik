import { RenderableObject } from "../../core/renderable_object";
import { Geometry } from "../../core/geometry";
import { Texture } from "../../objects/textures/texture";
import { Color } from "../../core/color";
import { TextureRgba } from "../textures/texture_rgba";
import { Texture2D } from "../textures/texture_2d";

type LabelImageRenderableProps = {
  geometry: Geometry;
  imageData: Texture;
  colorCycle: ReadonlyArray<Color>;
  colorMap?: ReadonlyMap<number, Color>;
};

export class LabelImageRenderable extends RenderableObject {
  constructor(props: LabelImageRenderableProps) {
    super();
    this.geometry = props.geometry;
    this.addTexture(props.imageData);
    const colorCycleTexture = this.makeColorCycleTexture(props.colorCycle);
    this.addTexture(colorCycleTexture);
    const colorMapTexture = this.makeColorMapTexture(props.colorMap);
    this.addTexture(colorMapTexture);
    this.programName = "labelImage";
  }

  public get type() {
    return "LabelImageRenderable";
  }

  public getUniforms() {
    return {
      ImageSampler: 0,
      ColorCycleSampler: 1,
      ColorMapSampler: 2,
    };
  }

  private makeColorCycleTexture(colorCycle: ReadonlyArray<Color>) {
    const data = new Uint8Array(
      colorCycle.flatMap((c) => c.rgba).map((v) => Math.round(v * 255))
    );
    return new TextureRgba(data, colorCycle.length, 1);
  }

  private makeColorMapTexture(colorMap?: ReadonlyMap<number, Color>) {
    if (colorMap === undefined) {
      colorMap = new Map([[0, Color.TRANSPARENT]]);
    } else if (!colorMap.has(0)) {
      colorMap = new Map([[0, Color.TRANSPARENT], ...colorMap]);
    }
    const keys = Array.from(colorMap.keys());
    const values = Array.from(colorMap.values()).map((c) => c.packed);
    const numColors = colorMap.size;
    const data = new Uint32Array(numColors * 2);
    data.set(keys, 0);
    data.set(values, numColors);
    return new Texture2D(data, numColors, 2);
  }
}
