import "./modulepreload-polyfill-DaKOjhqt.js";
import { L as Layer, t as transformMat4, d as create, I as Idetik, C as Color } from "./metadata_loaders-CXLkXwNR.js";
import { P as PlaneGeometry, O as OmeZarrImageSource, a as OrthographicCamera } from "./image_source-BemCU8_Z.js";
import { P as PanZoomControls } from "./controls-C_nkNJ-y.js";
import { C as ChunkedImageLayer } from "./chunked_image_layer-DuyACZAI.js";
import { L as LabelColorMap, a as LabelImageRenderable, T as Texture2D } from "./label_image_renderable-cSTAn_We.js";
import { h as handlePointPickingEvent } from "./point_picking-DP3wpFCw.js";
class LabelImageLayer extends Layer {
  type = "LabelImageLayer";
  source_;
  region_;
  lod_;
  colorMap_;
  onPickValue_;
  outlineSelected_;
  image_;
  imageChunk_;
  pointerDownPos_ = null;
  selectedValue_ = null;
  constructor({
    source,
    region,
    colorMap = {},
    onPickValue,
    lod: lod2,
    outlineSelected = false,
    ...layerOptions
  }) {
    super(layerOptions);
    this.setState("initialized");
    this.source_ = source;
    this.region_ = region;
    this.colorMap_ = new LabelColorMap(colorMap);
    this.onPickValue_ = onPickValue;
    this.lod_ = lod2;
    this.outlineSelected_ = outlineSelected;
  }
  update() {
    switch (this.state) {
      case "initialized":
        this.load(this.region_);
        break;
      case "loading":
      case "ready":
        break;
      default: {
        const exhaustiveCheck = this.state;
        throw new Error(`Unhandled LayerState case: ${exhaustiveCheck}`);
      }
    }
  }
  get colorMap() {
    return this.colorMap_;
  }
  setColorMap(colorMap) {
    this.colorMap_ = new LabelColorMap(colorMap);
    if (this.image_) {
      this.image_.setColorMap(this.colorMap_);
    }
  }
  setSelectedValue(value) {
    this.selectedValue_ = value;
    if (this.image_) {
      this.image_.setSelectedValue(this.selectedValue_);
    }
  }
  onEvent(event) {
    this.pointerDownPos_ = handlePointPickingEvent(
      event,
      this.pointerDownPos_,
      (world) => this.getValueAtWorld(world),
      this.outlineSelected_ ? (info) => {
        this.setSelectedValue(info.value);
        this.onPickValue_?.(info);
      } : this.onPickValue_
    );
  }
  async load(region) {
    if (this.state !== "initialized") {
      throw new Error(`Trying to load chunks more than once.`);
    }
    this.setState("loading");
    const loader2 = await this.source_.open();
    const attributes2 = loader2.getAttributes();
    const lod2 = this.lod_ ?? attributes2.length - 1;
    const chunk = await loader2.loadRegion(region, lod2);
    this.image_ = this.createImage(chunk);
    this.addObject(this.image_);
    this.setState("ready");
  }
  createImage(chunk) {
    this.imageChunk_ = chunk;
    const geometry = new PlaneGeometry(chunk.shape.x, chunk.shape.y, 1, 1);
    const image = new LabelImageRenderable({
      geometry,
      imageData: Texture2D.createWithChunk(chunk),
      colorMap: this.colorMap_,
      outlineSelected: this.outlineSelected_,
      selectedValue: this.selectedValue_
    });
    image.transform.setScale([chunk.scale.x, chunk.scale.y, 1]);
    image.transform.setTranslation([chunk.offset.x, chunk.offset.y, 0]);
    return image;
  }
  getValueAtWorld(world) {
    if (!this.image_ || !this.imageChunk_?.data) {
      return null;
    }
    const localPos = transformMat4(
      create(),
      world,
      this.image_.transform.inverse
    );
    const x = Math.floor(localPos[0]);
    const y = Math.floor(localPos[1]);
    if (x < 0 || x >= this.imageChunk_.shape.x || y < 0 || y >= this.imageChunk_.shape.y) {
      return null;
    }
    const pixelIndex = y * this.imageChunk_.rowStride + x;
    const data = this.imageChunk_.data;
    return data[pixelIndex];
  }
}
const baseUrl = "https://public.czbiohub.org/organelle_box/datasets/A549";
const fovName = "B/3/000000";
const imageUrl = `${baseUrl}/2024_11_07_A549_SEC61_DENV_cropped.zarr/${fovName}`;
const labelsUrl = `${baseUrl}/2024_11_07_A549_SEC61_DENV_tracking.zarr/${fovName}`;
const imageSource = new OmeZarrImageSource(imageUrl);
const labelsSource = new OmeZarrImageSource(labelsUrl);
const lod = 0;
const loader = await imageSource.open();
const attributes = loader.getAttributes();
const attributesAtLod = attributes[lod];
const phaseChannelIndex = 0;
const phaseContrastLimits = [20, 200];
const tStartPoint = 0;
const dimensionExtent = (dimensionName) => {
  const index = attributesAtLod.dimensionNames.findIndex(
    (d) => d === dimensionName
  );
  return {
    size: attributesAtLod.shape[index],
    scale: attributesAtLod.scale[index]
  };
};
const zExtent = dimensionExtent("Z");
const zMidPoint = 0.5 * zExtent.size * zExtent.scale;
const xExtent = dimensionExtent("X");
const xStopPoint = xExtent.size * xExtent.scale;
const yExtent = dimensionExtent("Y");
const yStopPoint = yExtent.size * yExtent.scale;
const sliceCoords = {
  t: tStartPoint,
  c: phaseChannelIndex,
  z: zMidPoint
};
const labelsRegion = [
  { dimension: "T", index: { type: "point", value: tStartPoint } },
  { dimension: "C", index: { type: "point", value: 0 } },
  { dimension: "Z", index: { type: "point", value: 0 } },
  { dimension: "Y", index: { type: "full" } },
  { dimension: "X", index: { type: "full" } }
];
const camera = new OrthographicCamera(0, xStopPoint, 0, yStopPoint);
const canvas = document.querySelector("canvas");
const pickInfoDiv = document.querySelector("#pick-info");
let outlineMode = false;
const infoBox = document.querySelector("#info-box");
const toggleDiv = document.createElement("div");
toggleDiv.innerHTML = '<strong>Mode:</strong> <span id="mode-text" style="cursor: pointer; text-decoration: underline;">Fill</span>';
toggleDiv.style.cursor = "pointer";
infoBox.appendChild(toggleDiv);
const imageLayer = new ChunkedImageLayer({
  source: imageSource,
  sliceCoords,
  transparent: true,
  channelProps: { contrastLimits: phaseContrastLimits }
});
function createLabelsLayer() {
  return new LabelImageLayer({
    source: labelsSource,
    region: labelsRegion,
    transparent: true,
    opacity: 0.25,
    blendMode: "normal",
    lod,
    outlineSelected: outlineMode,
    onPickValue: (info) => {
      const { world, value } = info;
      pickInfoDiv.innerHTML = `
        <strong>Pick Result:</strong><br/>
        World: (${world[0].toFixed(1)}, ${world[1].toFixed(1)}, ${world[2].toFixed(1)})<br/>
        Label Value: ${value}
      `;
      if (outlineMode) ;
      else {
        labelsLayer.setColorMap({
          cycle: Array.from(labelsLayer.colorMap.cycle),
          lookupTable: /* @__PURE__ */ new Map([[value, Color.WHITE]])
        });
      }
    }
  });
}
let labelsLayer = createLabelsLayer();
const idetik = new Idetik({
  canvas,
  camera,
  layers: [imageLayer, labelsLayer],
  cameraControls: new PanZoomControls(camera)
});
const modeText = document.querySelector("#mode-text");
toggleDiv.addEventListener("click", () => {
  outlineMode = !outlineMode;
  modeText.textContent = outlineMode ? "Outline" : "Fill";
  idetik.layerManager.remove(labelsLayer);
  labelsLayer = createLabelsLayer();
  idetik.layerManager.add(labelsLayer);
});
idetik.start();
//# sourceMappingURL=image_labels_overlay_with_value_picking-CeuLLR2s.js.map
