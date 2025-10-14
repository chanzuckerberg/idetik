import { RenderableObject } from "../../core/renderable_object";
import { PlaneGeometry } from "../../objects/geometry/plane_geometry";
import { Texture, TextureDataType } from "../../objects/textures/texture";
import { Color } from "../../core/color";
import { Texture2D } from "../textures/texture_2d";
import { LabelColorMap } from "./label_color_map";

type LabelImageRenderableProps = {
  width: number;
  height: number;
  imageData: Texture;
  colorMap: LabelColorMap;
  outlineSelected?: boolean;
  selectedValue?: number | null;
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
  private outlineSelected_: boolean;
  private selectedValue_: number | null;

  constructor(props: LabelImageRenderableProps) {
    super();
    this.geometry = new PlaneGeometry(props.width, props.height, 1, 1);
    this.setTexture(0, validateImageData(props.imageData));
    const colorCycleTexture = this.makeColorCycleTexture(props.colorMap.cycle);
    this.setTexture(1, colorCycleTexture);
    const colorLookupTableTexture = this.makeColorLookupTableTexture(
      props.colorMap.lookupTable
    );
    this.setTexture(2, colorLookupTableTexture);
    this.outlineSelected_ = props.outlineSelected ?? false;
    this.selectedValue_ = props.selectedValue ?? null;
    this.programName = "labelImage";
  }

  public get type() {
    return "LabelImageRenderable";
  }

  public getUniforms() {
    return {
      ImageSampler: 0,
      ColorCycleSampler: 1,
      ColorLookupTableSampler: 2,
      u_outlineSelected: this.outlineSelected_ ? 1.0 : 0.0,
      u_selectedValue: this.selectedValue_ ?? -1.0,
    };
  }

  public setColorMap(colorMap: LabelColorMap) {
    this.setTexture(1, this.makeColorCycleTexture(colorMap.cycle));
    this.setTexture(2, this.makeColorLookupTableTexture(colorMap.lookupTable));
  }

  public setSelectedValue(value: number | null) {
    this.selectedValue_ = value;
  }

  private makeColorCycleTexture(cycle: ReadonlyArray<Color>) {
    const data = new Uint8Array(
      cycle.flatMap((c) => c.rgba).map((v) => Math.round(v * 255))
    );
    const texture = new Texture2D(data, cycle.length, 1);
    texture.dataFormat = "rgba";
    return texture;
  }

  private makeColorLookupTableTexture(
    lookupTable?: ReadonlyMap<number, Color>
  ) {
    if (lookupTable === undefined) {
      lookupTable = new Map([[0, Color.TRANSPARENT]]);
    } else if (!lookupTable.has(0)) {
      lookupTable = new Map([[0, Color.TRANSPARENT], ...lookupTable]);
    }
    const keys = Array.from(lookupTable.keys());
    const values = Array.from(lookupTable.values()).map((c) => c.packed);
    const numColors = lookupTable.size;
    const data = new Uint32Array(numColors * 2);
    data.set(keys, 0);
    data.set(values, numColors);
    return new Texture2D(data, numColors, 2);
  }
}
