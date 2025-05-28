import {
  Idetik,
  LayerState,
  ImageSeriesLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  Region,
  ChannelProps,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";

const url =
  "https://files.cryoetdataportal.cziscience.com/10444/24apr23a_Position_12/Reconstructions/VoxelSpacing4.990/Tomograms/100/24apr23a_Position_12.zarr";

// Source is 3D with axes (z, y, x), so we provide an interval in z
const source = new OmeZarrImageSource(url);
const loader = await source.open();
const attributes = await loader.loadAttributes();
const zDimName = "z";
const zAxisIndex = attributes.dimensionNames.findIndex(
  (dim) => dim === zDimName
);
const zMin = 0;
const zMax = attributes.shape[zAxisIndex];
const region: Region = [
  { dimension: zDimName, index: { type: "full" } },
  { dimension: "x", index: { type: "full" } },
  { dimension: "y", index: { type: "full" } },
];

// This dataset is grayscale electron microscopy data
const channelProps: ChannelProps[] = [
  {
    visible: true,
    color: [1, 1, 1],
    contrastLimits: [-0.00001, 0.00001],
  },
];

const layer = new ImageSeriesLayer({
  source,
  region,
  seriesDimensionName: zDimName,
  channelProps,
});

layer.addStateChangeCallback((newState: LayerState) => {
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
  layers: [layer],
}).start();

layer.setIndex(zSlider.valueAsNumber);
const setCameraFrame = (newState: LayerState) => {
  if (newState === "ready" && layer.extent !== undefined) {
    camera.setFrame(0, layer.extent.x, 0, layer.extent.y);
    app.setControls(new PanZoomControls(camera, camera.position));
    camera.update();
    // remove the callback to only set the camera frame once
    layer.removeStateChangeCallback(setCameraFrame);
  }
};
layer.addStateChangeCallback(setCameraFrame);
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
  await layer.preloadSeries();
  loadAllButton.value = "Loaded all slices";
}

async function setLayerIndex(index: number) {
  zIndexEl!.textContent = "...";
  const result = await layer.setIndex(index);
  if (result.success) {
    zIndexEl!.textContent = `${index}`;
  }
}
