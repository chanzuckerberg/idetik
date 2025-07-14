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

// These roughly correspond in terms of content and the number of time-points.
// But the image is smaller in XY than the labels, and has a Z-stack, so it
// is unclear which Z-slice the labels correspond to (if any particular one)
const imageUrl =
  "https://public.czbiohub.org/organelle_box/datasets/A549/2024_11_07_A549_SEC61_DENV_cropped.zarr/B/3/000000";
const labelsUrl =
  "https://public.czbiohub.org/organelle_box/datasets/A549/2024_11_07_A549_SEC61_DENV_tracking.zarr/B/3/000000";

const imageSource = new OmeZarrImageSource(imageUrl);
const labelsSource = new OmeZarrImageSource(labelsUrl);

const loader = await imageSource.open();
const attributes = await loader.loadAttributes();
const lod = 0;
const attributesForLastLod = attributes[lod];

const tDimName = "T";
const tAxisIndex = attributesForLastLod.dimensionNames.findIndex(
  (dim) => dim === tDimName
);
const tMin = 0;
const tMax = attributesForLastLod.shape[tAxisIndex];

const imageRegion: Region = [
  { dimension: tDimName, index: { type: "full" } },
  { dimension: "C", index: { type: "full" } },
  // Mid-slice in Z.
  { dimension: "Z", index: { type: "point", value: 0.1494 * 4 } },
  { dimension: "Y", index: { type: "full" } },
  { dimension: "X", index: { type: "full" } },
];

const imageLayer = new ImageSeriesLayer({
  source: imageSource,
  region: imageRegion,
  seriesDimensionName: tDimName,
  transparent: true,
  channelProps: [
    {
      visible: true,
      // Phase with contrast limits chosen somewhat arbitrarily.
      color: Color.WHITE,
      contrastLimits: [0, 200],
    },
    {
      visible: true,
      // GFP with contrast limits chosen somewhat arbitrarily.
      color: Color.GREEN,
      contrastLimits: [0, 200],
    },
    {
      visible: true,
      // mCherry with contrast limits chosen somewhat arbitrarily.
      color: Color.RED,
      contrastLimits: [0, 200],
    },
  ],
  lod,
});

const labelsRegion: Region = [
  { dimension: "T", index: { type: "full" } },
  { dimension: "C", index: { type: "point", value: 0 } },
  { dimension: "Z", index: { type: "point", value: 0 } },
  { dimension: "Y", index: { type: "full" } },
  { dimension: "X", index: { type: "full" } },
];

const labelsLayer = new LabelSeriesLayer({
  source: labelsSource,
  region: labelsRegion,
  seriesDimensionName: tDimName,
  transparent: true,
  opacity: 0.25,
  blendMode: "normal",
  lod,
  colorCycle: [
    [1, 1, 0, 1],
    [0, 1, 1, 1],
    [1, 0, 1, 1],
  ],
  colorOverrides: new Map([
    [0, [0, 0, 0, 0]],
    // Arbitrarily pick segment 1 to be blue.
    [1, [0, 0, 1, 1]],
  ]),
});

imageLayer.addStateChangeCallback((newState: LayerState) => {
  stateEl!.textContent = newState;
});

const tSlider = document.querySelector<HTMLInputElement>("#t-slider")!;
const tIndexEl = document.querySelector<HTMLSpanElement>("#t-index")!;
const tTotalEl = document.querySelector<HTMLSpanElement>("#t-total")!;
const stateEl = document.querySelector<HTMLSpanElement>("#layer-state")!;
const loadAllButton = document.querySelector<HTMLButtonElement>("#load-all")!;

// Initialize sliders
tSlider.min = `${tMin}`;
tSlider.max = `${tMax - 1}`;
tSlider.value = "0";
tTotalEl.textContent = `${tMax - tMin - 1}`;

// set up event handler with debouncing
let debounce: ReturnType<typeof setTimeout>;
tSlider.addEventListener("input", (event) => {
  clearTimeout(debounce);
  const value = (event.target as HTMLInputElement).valueAsNumber;
  debounce = setTimeout(() => {
    setLayerIndex(value);
  }, 10);
});

const camera = new OrthographicCamera(0, 128, 0, 128);
const app = new Idetik({
  canvasSelector: "canvas",
  camera,
  layers: [imageLayer, labelsLayer],
}).start();

imageLayer.setIndex(tSlider.valueAsNumber);
labelsLayer.setIndex(tSlider.valueAsNumber);
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

async function setLayerIndex(index: number) {
  tIndexEl!.textContent = "...";
  const imageResult = await imageLayer.setIndex(index);
  const labelsResult = await labelsLayer.setIndex(index);
  if (imageResult.success && labelsResult.success) {
    tIndexEl!.textContent = `${index}`;
  }
}
