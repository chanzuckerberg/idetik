import "./modulepreload-polyfill-DaKOjhqt.js";
import { C as Color, I as Idetik } from "./metadata_loaders-CXLkXwNR.js";
import { O as OmeZarrImageSource, a as OrthographicCamera } from "./image_source-BemCU8_Z.js";
import { P as PanZoomControls } from "./controls-C_nkNJ-y.js";
import { I as ImageSeriesLayer } from "./image_series_layer-xl760NUg.js";
const baseUrl = "https://files.cryoetdataportal.cziscience.com/10444/24apr23a_Position_12/Reconstructions/VoxelSpacing4.990";
const imageUrl = `${baseUrl}/Tomograms/100/24apr23a_Position_12.zarr`;
const maskUrl = `${baseUrl}/Annotations/100/membrane-1.0_segmentationmask.zarr`;
const imageSource = new OmeZarrImageSource(imageUrl);
const loader = await imageSource.open();
const attributes = loader.getAttributes();
const lods = attributes.length;
const attributesForLastLod = attributes[lods - 1];
const zDimName = "z";
const zAxisIndex = attributesForLastLod.dimensionNames.findIndex(
  (dim) => dim === zDimName
);
const zMin = 0;
const zMax = attributesForLastLod.shape[zAxisIndex];
const region = [
  { dimension: zDimName, index: { type: "full" } },
  { dimension: "x", index: { type: "full" } },
  { dimension: "y", index: { type: "full" } }
];
const channelProps = [
  {
    visible: true,
    color: Color.WHITE,
    contrastLimits: [-1e-5, 1e-5]
  }
];
const imageLayer = new ImageSeriesLayer({
  source: imageSource,
  region,
  seriesDimensionName: zDimName,
  channelProps
});
imageLayer.addStateChangeCallback((newState) => {
  stateEl.textContent = newState;
});
const maskSource = new OmeZarrImageSource(maskUrl);
const maskLayer = new ImageSeriesLayer({
  source: maskSource,
  region,
  seriesDimensionName: zDimName,
  channelProps: [
    {
      visible: true,
      color: Color.RED,
      contrastLimits: [0, 1]
    }
  ],
  transparent: true,
  opacity: 0.5
});
const zSlider = document.querySelector("#z-slider");
const zIndexEl = document.querySelector("#z-index");
const zTotalEl = document.querySelector("#z-total");
const stateEl = document.querySelector("#layer-state");
const loadAllButton = document.querySelector("#load-all");
zSlider.min = `${zMin}`;
zSlider.max = `${zMax - 1}`;
zSlider.value = "0";
zTotalEl.textContent = `${zMax - zMin - 1}`;
let debounce;
zSlider.addEventListener("input", (event) => {
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
  layers: [imageLayer, maskLayer]
}).start();
imageLayer.setIndex(zSlider.valueAsNumber);
const setCameraFrame = (newState) => {
  if (newState === "ready" && imageLayer.extent !== void 0) {
    camera.setFrame(0, imageLayer.extent.x, 0, imageLayer.extent.y);
    app.cameraControls = new PanZoomControls(camera);
    camera.update();
    imageLayer.removeStateChangeCallback(setCameraFrame);
  }
};
imageLayer.addStateChangeCallback(setCameraFrame);
setLayerIndex(zSlider.valueAsNumber);
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
  await maskLayer.preloadSeries();
  loadAllButton.value = "Loaded all slices";
}
async function setLayerIndex(index) {
  zIndexEl.textContent = "...";
  const imageResult = await imageLayer.setIndex(index);
  const maskResult = await maskLayer.setIndex(index);
  if (imageResult.success && maskResult.success) {
    zIndexEl.textContent = `${index}`;
  }
}
//# sourceMappingURL=image_mask_overlay-DaRaBSfj.js.map
