import "./modulepreload-polyfill-DaKOjhqt.js";
import { L as Layer, C as Color, I as Idetik } from "./metadata_loaders-CXLkXwNR.js";
import { P as PlaneGeometry, O as OmeZarrImageSource, a as OrthographicCamera } from "./image_source-BemCU8_Z.js";
import { P as PanZoomControls } from "./controls-C_nkNJ-y.js";
import { a as ImageSeriesLoader, I as ImageSeriesLayer } from "./image_series_layer-xl760NUg.js";
import { L as LabelColorMap, T as Texture2D, a as LabelImageRenderable } from "./label_image_renderable-cSTAn_We.js";
class LabelImageSeriesLayer extends Layer {
  type = "LabelImageSeriesLayer";
  seriesLoader_;
  colorMap_;
  texture_ = null;
  image_;
  extent_;
  constructor({
    source,
    region: region2,
    seriesDimensionName,
    colorMap = {},
    lod: lod2,
    ...layerOptions
  }) {
    super(layerOptions);
    this.setState("initialized");
    this.colorMap_ = new LabelColorMap(colorMap);
    this.seriesLoader_ = new ImageSeriesLoader({
      source,
      region: region2,
      seriesDimensionName,
      lod: lod2
    });
  }
  update() {
    if (this.state === "initialized") {
      this.setState("loading");
      this.seriesLoader_.loadSeriesAttributes();
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
  async setPosition(position) {
    const result = await this.seriesLoader_.setPosition(position);
    return this.processIndexResult(result);
  }
  async setIndex(index) {
    const result = await this.seriesLoader_.setIndex(index);
    return this.processIndexResult(result);
  }
  close() {
    this.seriesLoader_.shutdown();
  }
  async preloadSeries() {
    return this.seriesLoader_.preloadAllChunks();
  }
  get extent() {
    return this.extent_;
  }
  processIndexResult(result) {
    if (result.chunk) {
      this.setData(result.chunk);
      this.setState("ready");
    }
    return result;
  }
  setData(chunk) {
    if (!this.texture_ || !this.image_) {
      this.texture_ = Texture2D.createWithChunk(chunk);
      this.image_ = this.createImage(chunk, this.texture_);
      this.addObject(this.image_);
      this.extent_ = {
        x: chunk.shape.x * chunk.scale.x,
        y: chunk.shape.y * chunk.scale.y
      };
    } else if (chunk.data) {
      this.texture_.updateWithChunk(chunk);
    }
  }
  createImage(chunk, texture) {
    const geometry = new PlaneGeometry(chunk.shape.x, chunk.shape.y, 1, 1);
    const image = new LabelImageRenderable({
      geometry,
      imageData: texture,
      colorMap: this.colorMap_
    });
    image.transform.setScale([chunk.scale.x, chunk.scale.y, 1]);
    image.transform.setTranslation([chunk.offset.x, chunk.offset.y, 0]);
    return image;
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
const dimensionExtent = (dimensionName) => {
  const index = attributesAtLod.dimensionNames.findIndex(
    (d) => d === dimensionName
  );
  return {
    size: attributesAtLod.shape[index],
    scale: attributesAtLod.scale[index]
  };
};
const tExtent = dimensionExtent("T");
const tMin = 0;
const tMax = tExtent.size;
const zExtent = dimensionExtent("Z");
const zMidPoint = 0.5 * zExtent.size * zExtent.scale;
const region = [
  { dimension: "T", index: { type: "full" } },
  { dimension: "C", index: { type: "point", value: phaseChannelIndex } },
  { dimension: "Z", index: { type: "point", value: zMidPoint } },
  { dimension: "X", index: { type: "full" } },
  { dimension: "Y", index: { type: "full" } }
];
const imageLayer = new ImageSeriesLayer({
  source: imageSource,
  region,
  seriesDimensionName: "T",
  lod,
  channelProps: [
    {
      visible: true,
      color: Color.WHITE,
      contrastLimits: phaseContrastLimits
    }
  ]
});
imageLayer.addStateChangeCallback((newState) => {
  stateEl.textContent = newState;
});
const labelsRegion = [
  { dimension: "T", index: { type: "full" } },
  { dimension: "C", index: { type: "point", value: 0 } },
  { dimension: "Z", index: { type: "point", value: 0 } },
  { dimension: "Y", index: { type: "full" } },
  { dimension: "X", index: { type: "full" } }
];
const labelsLayer = new LabelImageSeriesLayer({
  source: labelsSource,
  region: labelsRegion,
  seriesDimensionName: "T",
  transparent: true,
  opacity: 0.25,
  blendMode: "normal",
  lod
});
const tSlider = document.querySelector("#t-slider");
const tIndexEl = document.querySelector("#t-index");
const tTotalEl = document.querySelector("#t-total");
const stateEl = document.querySelector("#layer-state");
const loadAllButton = document.querySelector("#load-all");
tSlider.min = `${tMin}`;
tSlider.max = `${tMax - 1}`;
tSlider.value = "0";
tTotalEl.textContent = `${tMax - tMin - 1}`;
let debounce;
tSlider.addEventListener("input", (event) => {
  clearTimeout(debounce);
  const value = event.target.valueAsNumber;
  debounce = setTimeout(() => {
    setLayerIndex(value);
  }, 20);
});
const camera = new OrthographicCamera(0, 128, 0, 128);
const app = new Idetik({
  canvas: document.querySelector("canvas"),
  camera,
  layers: [imageLayer, labelsLayer]
}).start();
imageLayer.setIndex(tSlider.valueAsNumber);
const setCameraFrame = (newState) => {
  if (newState === "ready" && imageLayer.extent !== void 0) {
    camera.setFrame(0, imageLayer.extent.x, 0, imageLayer.extent.y);
    app.cameraControls = new PanZoomControls(camera);
    camera.update();
    imageLayer.removeStateChangeCallback(setCameraFrame);
  }
};
imageLayer.addStateChangeCallback(setCameraFrame);
setLayerIndex(tSlider.valueAsNumber);
loadAllButton.addEventListener("click", () => {
  try {
    preloadAllSlices();
  } catch (error) {
    console.error("Error preloading slices:", error);
    loadAllButton.value = "Error loading slices";
  }
});
async function preloadAllSlices() {
  console.log("loading all slices");
  loadAllButton.disabled = true;
  loadAllButton.value = "Loading all slices...";
  await imageLayer.preloadSeries();
  await labelsLayer.preloadSeries();
  loadAllButton.value = "Loaded all slices";
}
async function setLayerIndex(index) {
  tIndexEl.textContent = "...";
  const imageResult = await imageLayer.setIndex(index);
  const labelsResult = await labelsLayer.setIndex(index);
  if (imageResult.success && labelsResult.success) {
    tIndexEl.textContent = `${index}`;
  }
}
document.querySelector("#color-cycle-default").addEventListener("click", () => {
  console.debug("Resetting color map to default");
  labelsLayer.setColorMap({});
});
document.querySelector("#color-cycle-cmy").addEventListener("click", () => {
  console.debug("Resetting color map to CMY cycle");
  labelsLayer.setColorMap({
    cycle: [Color.CYAN, Color.MAGENTA, Color.YELLOW]
  });
});
document.querySelector("#color-cycle-rgb").addEventListener("click", () => {
  console.debug("Resetting color map to RGB cycle");
  labelsLayer.setColorMap({ cycle: [Color.RED, Color.GREEN, Color.BLUE] });
});
//# sourceMappingURL=image_series_labels_overlay-Czer4ETz.js.map
