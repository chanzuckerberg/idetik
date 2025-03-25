import {
  LayerManager,
  LayerState,
  ImageSeriesLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  Region,
  WebGLRenderer,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";

const url =
  "https://files.cryoetdataportal.cziscience.com/10444/24apr23a_Position_12/Reconstructions/VoxelSpacing4.990/Tomograms/100/24apr23a_Position_12.zarr";
const layerManager = new LayerManager();
const renderer = new WebGLRenderer("#canvas");
const camera = new OrthographicCamera(0, 128, 0, 128);

// Source is 3D with axes (z, y, x), so we provide an interval in z
const source = new OmeZarrImageSource(url);
const loader = await source.open();
const attributes = await loader.loadAttributes();
const zDimName = "z";
const zAxisIndex = attributes.dimensions.findIndex((dim) => dim === zDimName);
const zMin = 0;
const zMax = attributes.shape[zAxisIndex];
console.log(attributes);
const region: Region = [
  { dimension: zDimName, index: { type: "full" } },
  { dimension: "x", index: { type: "full" } },
  { dimension: "y", index: { type: "full" } },
];

// Initial contrast limits for grayscale electron microscopy data
const initialMinValue = -0.00001;
const initialMaxValue = 0.00001;

// This dataset is grayscale electron microscopy data
const channelProps = [
  {
    visible: true,
    color: [1, 1, 1] as [number, number, number],
    contrastLimits: [initialMinValue, initialMaxValue] as [number, number],
  },
];

const layer = new ImageSeriesLayer({
  source,
  region,
  seriesDimensionName: zDimName,
  channelProps,
});
layerManager.add(layer);

// Get DOM elements
const zSlider = document.querySelector<HTMLInputElement>("#z-slider");
const zIndexEl = document.querySelector<HTMLSpanElement>("#z-index");
const zTotalEl = document.querySelector<HTMLSpanElement>("#z-total");
const minSlider = document.querySelector<HTMLInputElement>("#min-slider");
const maxSlider = document.querySelector<HTMLInputElement>("#max-slider");
const minValueEl = document.querySelector<HTMLSpanElement>("#min-value");
const maxValueEl = document.querySelector<HTMLSpanElement>("#max-value");
const stateEl = document.querySelector<HTMLSpanElement>("#layer-state");

// Check that all elements exist
if (!zSlider || !zIndexEl || !zTotalEl || !minSlider || !maxSlider || !minValueEl || !maxValueEl) {
  throw new Error("Could not find all necessary elements");
}

// Initialize sliders
zSlider.min = `${zMin}`;
zSlider.max = `${zMax - 1}`;
zSlider.value = "0";
zTotalEl.textContent = `${zMax - zMin - 1}`;

minSlider.min = "-0.00005";
minSlider.max = "0";
minSlider.step = "0.000001";
minSlider.value = `${initialMinValue.toFixed(6)}`;

maxSlider.min = "0";
maxSlider.max = "0.00005";
maxSlider.step = "0.000001";
maxSlider.value = `${initialMaxValue.toFixed(6)}`;

minValueEl.textContent = `${initialMinValue}`;
maxValueEl.textContent = `${initialMaxValue}`;

// Set up event handlers for contrast sliders
minSlider.addEventListener("input", (event) => {
  const minValue = (event.target as HTMLInputElement).valueAsNumber;
  const maxValue = maxSlider.valueAsNumber;
  minValueEl.textContent = minValue.toFixed(6);
  // Update channel properties
  layer.setChannelProps([
    {
      visible: true,
      color: [1, 1, 1],
      contrastLimits: [minValue, maxValue],
    },
  ]);
});

maxSlider.addEventListener("input", (event) => {
  const maxValue = (event.target as HTMLInputElement).valueAsNumber;
  const minValue = minSlider.valueAsNumber;
  maxValueEl.textContent = maxValue.toFixed(6);
  // Update channel properties
  layer.setChannelProps([
    {
      visible: true,
      color: [1, 1, 1],
      contrastLimits: [minValue, maxValue],
    },
  ]);
});

// set up event handler with debouncing
let debounce: number;
zSlider.addEventListener("input", (event) => {
  clearTimeout(debounce);
  const value = (event.target as HTMLInputElement).valueAsNumber;
  debounce = setTimeout(() => {
    layer.setIndex(value);
    zIndexEl.textContent = `${value}`;
  }, 100);
});

layer.setIndex(zSlider.valueAsNumber);
layer.addStateChangeCallback((newState: LayerState) => {
  if (newState === "ready") {
    if (layer.extent !== undefined) {
      camera.setFrame(0, layer.extent.x, 0, layer.extent.y);
      renderer.setControls(new PanZoomControls(camera, camera.position));
      camera.update();
    }
  }
});
layer.addStateChangeCallback((newState: LayerState) => {
  stateEl!.textContent = newState;
});

function animate() {
  renderer.render(layerManager, camera);
  requestAnimationFrame(animate);
}

animate();
