import { C as Color, R as RenderableObject } from "./metadata_loaders-CXLkXwNR.js";
import { b as Texture, c as bufferToDataType } from "./image_source-BemCU8_Z.js";
class Texture2D extends Texture {
  data_;
  width_;
  height_;
  constructor(data, width, height) {
    super();
    this.dataFormat = "scalar";
    this.dataType = bufferToDataType(data);
    this.data_ = data;
    this.width_ = width;
    this.height_ = height;
  }
  set data(data) {
    this.data_ = data;
    this.needsUpdate = true;
  }
  get type() {
    return "Texture2D";
  }
  get data() {
    return this.data_;
  }
  get width() {
    return this.width_;
  }
  get height() {
    return this.height_;
  }
  updateWithChunk(chunk, data) {
    const source = data ?? chunk.data;
    if (!source) {
      throw new Error(
        "Unable to update texture, chunk data is not initialized."
      );
    }
    if (this.data === source) return;
    if (this.width != chunk.shape.x || this.height != chunk.shape.y || this.dataType != bufferToDataType(source)) {
      throw new Error("Unable to update texture, texture buffer mismatch.");
    }
    this.data = source;
  }
  static createWithChunk(chunk, data) {
    const source = data ?? chunk.data;
    if (!source) {
      throw new Error(
        "Unable to create texture, chunk data is not initialized."
      );
    }
    const texture = new Texture2D(source, chunk.shape.x, chunk.shape.y);
    texture.unpackRowLength = chunk.rowStride;
    texture.unpackAlignment = chunk.rowAlignmentBytes;
    return texture;
  }
}
const defaultColorCycle = [
  [1, 0.5, 0.5],
  [0.5, 1, 0.5],
  [0.5, 0.5, 1],
  [0.5, 1, 1],
  [1, 0.5, 1],
  [1, 1, 0.5]
];
function validateLookupTable(lookupTable) {
  lookupTable = lookupTable ?? /* @__PURE__ */ new Map();
  return new Map(
    Array.from(lookupTable.entries()).map(([key, value]) => [
      key,
      Color.from(value)
    ])
  );
}
function validateCycle(cycle) {
  cycle = cycle ?? defaultColorCycle;
  return cycle.map(Color.from);
}
class LabelColorMap {
  lookupTable;
  cycle;
  constructor(props = {}) {
    this.lookupTable = validateLookupTable(props.lookupTable);
    this.cycle = validateCycle(props.cycle);
  }
}
const supportedDataTypes = /* @__PURE__ */ new Set([
  "unsigned_byte",
  "unsigned_short",
  "unsigned_int"
]);
function validateImageData(imageData) {
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
class LabelImageRenderable extends RenderableObject {
  outlineSelected_;
  selectedValue_;
  constructor(props) {
    super();
    this.geometry = props.geometry;
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
  get type() {
    return "LabelImageRenderable";
  }
  getUniforms() {
    return {
      ImageSampler: 0,
      ColorCycleSampler: 1,
      ColorLookupTableSampler: 2,
      u_outlineSelected: this.outlineSelected_ ? 1 : 0,
      u_selectedValue: this.selectedValue_ ?? -1
    };
  }
  setColorMap(colorMap) {
    this.setTexture(1, this.makeColorCycleTexture(colorMap.cycle));
    this.setTexture(2, this.makeColorLookupTableTexture(colorMap.lookupTable));
  }
  setSelectedValue(value) {
    this.selectedValue_ = value;
  }
  makeColorCycleTexture(cycle) {
    const data = new Uint8Array(
      cycle.flatMap((c) => c.rgba).map((v) => Math.round(v * 255))
    );
    const texture = new Texture2D(data, cycle.length, 1);
    texture.dataFormat = "rgba";
    return texture;
  }
  makeColorLookupTableTexture(lookupTable) {
    if (lookupTable === void 0) {
      lookupTable = /* @__PURE__ */ new Map([[0, Color.TRANSPARENT]]);
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
export {
  LabelColorMap as L,
  Texture2D as T,
  LabelImageRenderable as a
};
//# sourceMappingURL=label_image_renderable-cSTAn_We.js.map
