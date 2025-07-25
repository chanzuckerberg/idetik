import { RenderableObject } from "../../core/renderable_object";
import { Geometry } from "../../core/geometry";
import { Texture, TextureDataType } from "../../objects/textures/texture";
import { Color } from "../../core/color";
import { TextureRgba } from "../textures/texture_rgba";

type LabelImageRenderableProps = {
  geometry: Geometry;
  imageData: Texture;
  colorCycle: ReadonlyArray<Color>;
};

const supportedDataTypes = new Set<TextureDataType>([
  "unsigned_byte",
  "unsigned_short",
  "unsigned_int",
]);

function validateImageData(imageData: Texture) {
  if (imageData.dataFormat !== "scalar") {
    throw new Error(
      `Image data format must be scalar, instead found: ${imageData.dataFormat}`
    );
  }
  if (!supportedDataTypes.has(imageData.dataType)) {
    throw new Error(
      `Image data type must be unsigned, instead found: ${imageData.dataType}`
    );
  }
  return imageData;
}

export class LabelImageRenderable extends RenderableObject {
  constructor(props: LabelImageRenderableProps) {
    super();
    this.geometry = props.geometry;
    this.addTexture(validateImageData(props.imageData));
    const colorCycleTexture = this.makeColorCycleTexture(props.colorCycle);
    this.addTexture(colorCycleTexture);
    this.programName = "labelImage";
  }

  public get type() {
    return "LabelImageRenderable";
  }

  public getUniforms() {
    return {
      ImageSampler: 0,
      ColorCycleSampler: 1,
    };
  }

  private makeColorCycleTexture(colorCycle: ReadonlyArray<Color>) {
    const data = new Uint8Array(
      colorCycle.flatMap((c) => c.rgba).map((v) => Math.round(v * 255))
    );
    return new TextureRgba(data, colorCycle.length, 1);
  }
}
