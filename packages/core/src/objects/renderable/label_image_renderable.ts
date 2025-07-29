import { RenderableObject } from "../../core/renderable_object";
import { Geometry } from "../../core/geometry";
import { Texture, TextureDataType } from "../../objects/textures/texture";
import { Color, LabelColorMap } from "../../core/color";
import { Texture2D } from "../textures/texture_2d";

type LabelImageRenderableProps = {
  geometry: Geometry;
  imageData: Texture;
  colorMap: LabelColorMap;
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
    const colorCycleTexture = this.makeColorCycleTexture(props.colorMap.cycle);
    this.addTexture(colorCycleTexture);
    const colorLutTexture = this.makeColorLutTexture(props.colorMap.lut);
    this.addTexture(colorLutTexture);
    this.programName = "labelImage";
  }

  public get type() {
    return "LabelImageRenderable";
  }

  public getUniforms() {
    return {
      ImageSampler: 0,
      ColorCycleSampler: 1,
      ColorLutSampler: 2,
    };
  }

  private makeColorCycleTexture(colorCycle: ReadonlyArray<Color>) {
    const data = new Uint8Array(
      colorCycle.flatMap((c) => c.rgba).map((v) => Math.round(v * 255))
    );
    const texture = new Texture2D(data, colorCycle.length, 1);
    texture.dataFormat = "rgba";
    return texture;
  }

  private makeColorLutTexture(colorMap?: ReadonlyMap<number, Color>) {
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
