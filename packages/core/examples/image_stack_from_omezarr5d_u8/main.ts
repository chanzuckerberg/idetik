import {
  LayerManager,
  LayerState,
  ImageStackLayer,
  OrthographicCamera,
  WebGLRenderer,
  OmeZarrImageSource,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";

const url =
  "https://files.cryoetdataportal.cziscience.com/10444/24apr23a_Position_12/Reconstructions/VoxelSpacing4.990/Tomograms/100/24apr23a_Position_12.zarr";
const pixelScale = 4.99;
const layerManager = new LayerManager();
const renderer = new WebGLRenderer("#canvas");
const camera = new OrthographicCamera(
  0,
  pixelScale * 1264,
  0,
  pixelScale * 1264
);
const controls = new PanZoomControls(camera, camera.position);
renderer.setControls(controls);

// Source is 3D with axes (z, y, x), so we provide an interval in z
// to get a Z-stack.
const source = new OmeZarrImageSource(url);
const zInterval = { start: 0, stop: 1000 };
const region = [{ dimension: "z", index: zInterval }];

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

const layer = new ImageStackLayer({
  source,
  region,
  zDimension: "z",
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

// Check that all elements exist
if (!zSlider) throw new Error("Z slider not found.");
if (!zIndexEl) throw new Error("Z index element not found.");
if (!zTotalEl) throw new Error("Z total element not found.");
if (!minSlider) throw new Error("Min slider not found.");
if (!maxSlider) throw new Error("Max slider not found.");
if (!minValueEl) throw new Error("Min value element not found.");
if (!maxValueEl) throw new Error("Max value element not found.");

// Initialize sliders
zSlider.min = "0";
zSlider.max = (300).toString();
zSlider.value = "0";

minSlider.min = "-0.00005";
minSlider.max = "0";
minSlider.step = "0.000001";
minSlider.value = initialMinValue.toString();

maxSlider.min = "0";
maxSlider.max = "0.00005";
maxSlider.step = "0.000001";
maxSlider.value = initialMaxValue.toString();

minValueEl.textContent = initialMinValue.toString();
maxValueEl.textContent = initialMaxValue.toString();

// Set up event handlers for contrast sliders
minSlider.addEventListener("input", (event) => {
  const minValue = (event.target as HTMLInputElement).valueAsNumber;
  const maxValue = maxSlider.valueAsNumber;

  // Ensure min doesn't exceed max
  if (minValue >= maxValue) {
    minSlider.value = (maxValue - 0.01).toString();
    return;
  }

  minValueEl.textContent = minValue.toFixed(2);

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

  // Ensure max doesn't go below min
  if (maxValue <= minValue) {
    maxSlider.value = (minValue + 0.01).toString();
    return;
  }

  maxValueEl.textContent = maxValue.toFixed(2);

  // Update channel properties
  layer.setChannelProps([
    {
      visible: true,
      color: [1, 1, 1],
      contrastLimits: [minValue, maxValue],
    },
  ]);
});

layer.addStateChangeCallback((newState: LayerState) => {
  if (newState === "ready") {
    // Update Z total display
    const zSize = layer.getZSize();
    zTotalEl.textContent = (zSize - 1).toString();

    // Set up slider event handler
    zSlider.addEventListener("input", (event) => {
      const value = (event.target as HTMLInputElement).valueAsNumber;
      try {
        layer.setZIndex(value);
        zIndexEl.textContent = value.toString();
      } catch {
        console.debug("Tried to set Z index out of bounds");
      }
    });

    // Display the first Z slice
    layer.setZIndex(0);
    zIndexEl.textContent = "0";
  }
});

function animate() {
  renderer.render(layerManager, camera);
  requestAnimationFrame(animate);
}

animate();
