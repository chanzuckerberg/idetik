import {
  Idetik,
  LayerState,
  OmeZarrImageSource,
  OrthographicCamera,
  Region,
  Color,
  ImageSeriesLayer,
  LabelSeriesLayer,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";

// From: https://zenodo.org/records/7144919
const imageUrl = "http://127.0.0.1:8080/20200812-CardiomyocyteDifferentiation14-Cycle1.zarr/B/03/0";
const labelsUrl = "http://127.0.0.1:8080/20200812-CardiomyocyteDifferentiation14-Cycle1.zarr/B/03/0/labels/nuclei";

const imageSource = new OmeZarrImageSource(imageUrl);
const labelsSource = new OmeZarrImageSource(labelsUrl);

const loader = await imageSource.open();
const attributes = await loader.loadAttributes();
const lod = 0;
const attributesForLastLod = attributes[lod];

const zDimName = "z";
const zAxisIndex = attributesForLastLod.dimensionNames.findIndex(
  (dim) => dim === zDimName
);
const zMin = 0;
const zMax = attributesForLastLod.shape[zAxisIndex];

const imageRegion: Region = [
  { dimension: "c", index: { type: "point", value: 0 } },
  { dimension: zDimName, index: { type: "full" } },
  { dimension: "y", index: { type: "full" } },
  { dimension: "x", index: { type: "full" } },
];

const imageLayer = new ImageSeriesLayer({
  source: imageSource,
  region: imageRegion,
  seriesDimensionName: zDimName,
  channelProps: [
    {
      visible: true,
      color: Color.WHITE,
      contrastLimits: [0, 500],
    },
  ],
  lod,
});

const labelsRegion: Region = [
  { dimension: zDimName, index: { type: "full" } },
  { dimension: "y", index: { type: "full" } },
  { dimension: "x", index: { type: "full" } },
];

const labelsLayer = new LabelSeriesLayer({
  source: labelsSource,
  region: labelsRegion,
  seriesDimensionName: zDimName,
  transparent: true,
  opacity: 0.25,
  blendMode: "normal",
  lod,
});

imageLayer.addStateChangeCallback((newState: LayerState) => {
  stateEl!.textContent = newState;
});

const zSlider = document.querySelector<HTMLInputElement>("#z-slider")!;
const zIndexEl = document.querySelector<HTMLSpanElement>("#z-index")!;
const zTotalEl = document.querySelector<HTMLSpanElement>("#z-total")!;
const stateEl = document.querySelector<HTMLSpanElement>("#layer-state")!;
const loadAllButton = document.querySelector<HTMLButtonElement>("#load-all")!;

// Initialize sliders
zSlider.min = `${zMin}`;
zSlider.max = `${zMax - 1}`;
zSlider.value = "0";
zTotalEl.textContent = `${zMax - zMin - 1}`;

// set up event handler with debouncing
let debounce: ReturnType<typeof setTimeout>;
zSlider.addEventListener("input", (event) => {
  clearTimeout(debounce);
  const value = (event.target as HTMLInputElement).valueAsNumber;
  debounce = setTimeout(() => {
    setLayerIndex(value);
  }, 20);
});

const camera = new OrthographicCamera(0, 128, 0, 128);
const app = new Idetik({
  canvasSelector: "canvas",
  camera,
  layers: [imageLayer, labelsLayer],
}).start();

imageLayer.setIndex(zSlider.valueAsNumber);
labelsLayer.setIndex(zSlider.valueAsNumber);
const setCameraFrame = (newState: LayerState) => {
  if (newState === "ready" && imageLayer.extent !== undefined) {
    camera.setFrame(0, imageLayer.extent.x, 0, imageLayer.extent.y);
    app.setControls(new PanZoomControls(camera, camera.position));
    camera.update();
    // remove the callback to only set the camera frame once
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
  await labelsLayer.preloadSeries();
  loadAllButton.value = "Loaded all slices";
}

async function setLayerIndex(index: number) {
  zIndexEl!.textContent = "...";
  const imageResult = await imageLayer.setIndex(index);
  const labelsResult = await labelsLayer.setIndex(index);
  if (imageResult.success && labelsResult.success) {
    zIndexEl!.textContent = `${index}`;
  }
} 