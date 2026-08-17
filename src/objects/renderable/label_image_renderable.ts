import { RenderableObject } from "../../core/renderable_object";
import { PlaneGeometry } from "../../objects/geometry/plane_geometry";
import { mat4 } from "gl-matrix";
import { Texture, TextureDataType } from "../../objects/textures/texture";
import { Color, ColorLike } from "../../math/color";
import { Texture2D } from "../textures/texture_2d";
import { Shader } from "../../renderers/shaders";

const defaultColorCycle: ColorLike[] = [
  [1.0, 0.5, 0.5],
  [0.5, 1.0, 0.5],
  [0.5, 0.5, 1.0],
  [0.5, 1.0, 1.0],
  [1.0, 0.5, 1.0],
  [1.0, 1.0, 0.5],
];

function validateLookupTable(
  lookupTable?: ReadonlyMap<number, ColorLike>
): ReadonlyMap<number, Color> {
  lookupTable = lookupTable ?? new Map();
  return new Map(
    Array.from(lookupTable.entries()).map(([key, value]) => [
      key,
      Color.from(value),
    ])
  );
}

function validateCycle(cycle?: ReadonlyArray<ColorLike>): ReadonlyArray<Color> {
  cycle = cycle ?? defaultColorCycle;
  return cycle.map(Color.from);
}

export type LabelColorMapProps = {
  lookupTable?: ReadonlyMap<number, ColorLike>;
  cycle?: ReadonlyArray<ColorLike>;
};

export type ValidatedLabelColorMap = {
  lookupTable: ReadonlyMap<number, Color>;
  cycle: ReadonlyArray<Color>;
};

export function validateColorMap(
  props: LabelColorMapProps = {}
): ValidatedLabelColorMap {
  return {
    lookupTable: validateLookupTable(props.lookupTable),
    cycle: validateCycle(props.cycle),
  };
}

type LabelImageRenderableProps = {
  width: number;
  height: number;
  imageData: Texture;
  colorMap: LabelColorMapProps;
  outlineSelected?: boolean;
  selectedValue?: number | null;
};

const signedDataTypes = new Set<TextureDataType>(["byte", "short", "int"]);
const unsignedDataTypes = new Set<TextureDataType>([
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
  if (
    !signedDataTypes.has(imageData.dataType) &&
    !unsignedDataTypes.has(imageData.dataType)
  ) {
    throw new Error(
      `Image data type must be an integer, instead found: ${imageData.dataType}`
    );
  }
  return imageData;
}

function labelTextureToShader(texture: Texture): Shader {
  return signedDataTypes.has(texture.dataType) ? "intLabelImage" : "labelImage";
}

/** @group Renderable Objects */
export class LabelImageRenderable extends RenderableObject {
  private outlineSelected_: boolean;
  private selectedValue_: number | null;

  public worldToTexCoord: mat4 = mat4.create();

  constructor(props: LabelImageRenderableProps) {
    super();
    this.geometry = new PlaneGeometry(props.width, props.height, 1, 1);
    this.setTexture(0, validateImageData(props.imageData));
    const colorMap = validateColorMap(props.colorMap);
    this.setTexture(1, this.makeColorCycleTexture(colorMap.cycle));
    this.setTexture(2, this.makeColorLookupTableTexture(colorMap.lookupTable));
    this.outlineSelected_ = props.outlineSelected ?? false;
    this.selectedValue_ = props.selectedValue ?? null;
    this.programName = labelTextureToShader(props.imageData);
  }

  public get type() {
    return "LabelImageRenderable";
  }

  public getUniforms() {
    return {
      u_imageSampler: 0,
      u_colorCycleSampler: 1,
      u_colorLookupTableSampler: 2,
      u_outlineSelected: this.outlineSelected_ ? 1.0 : 0.0,
      u_selectedValue: this.selectedValue_ ?? -1.0,
      u_worldToTexCoord: this.worldToTexCoord,
    };
  }

  public setColorMap(colorMap: LabelColorMapProps) {
    const validated = validateColorMap(colorMap);
    this.markStaleTexture(this.textures[1]);
    this.markStaleTexture(this.textures[2]);
    this.setTexture(1, this.makeColorCycleTexture(validated.cycle));
    this.setTexture(2, this.makeColorLookupTableTexture(validated.lookupTable));
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
