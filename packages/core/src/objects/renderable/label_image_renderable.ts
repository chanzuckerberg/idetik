import { RenderableObject } from "../../core/renderable_object";
import { Geometry } from "../../core/geometry";
import { Texture } from "../../objects/textures/texture";
import { Color } from "../../core/color";
import { TextureRgba } from "../textures/texture_rgba";

type LabelImageRenderableProps = {
  geometry: Geometry;
  imageData: Texture;
  colorCycle: ReadonlyArray<Color>;
};

export class LabelImageRenderable extends RenderableObject {
  constructor(props: LabelImageRenderableProps) {
    super();
    this.geometry = props.geometry;
    this.addTexture(props.imageData);
    const colorCycleTexture = this.makeColorCycleTexture(props.colorCycle);
    this.addTexture(colorCycleTexture);
    this.programName = "labelImage";
  }

  public get type() {
    return "LabelImageRenderable";
  }

  private makeColorCycleTexture(colorCycle: ReadonlyArray<Color>) {
    const data = new Uint8Array(
      colorCycle.flatMap((c) => c.rgba).map((v) => Math.round(v * 255))
    );
    return new TextureRgba(data, colorCycle.length, 1);
  }
}
