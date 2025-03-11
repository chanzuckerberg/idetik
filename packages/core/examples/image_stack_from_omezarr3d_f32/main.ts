import {
  LayerManager,
  LayerState,
  ImageStackLayer,
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
const source = new OmeZarrImageSource(url, -1);
const loader = await source.open();
const attributes = await loader.loadAttributes();
const zDimName = "z";
const zAxisIndex = attributes.dimensions.findIndex((dim) => dim === zDimName);
const zMin = 0;
const zMax = attributes.shape[zAxisIndex];
const region: Region = [
  // empty Z dimension interval will load the entire Z stack
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

const layer = new ImageStackLayer({
  source,
  region,
  zDimension: zDimName,
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
zSlider.min = zMin.toString();
zSlider.max = zMax.toString();
zSlider.value = "0";
zTotalEl.textContent = (zMax - zMin - 1).toString();

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

    if (layer.extent !== undefined) {
      camera.setFrame(0, layer.extent.x, 0, layer.extent.y);
      renderer.setControls(new PanZoomControls(camera, camera.position));
      camera.update();
    }
  }
});

function animate() {
  renderer.render(layerManager, camera);
  requestAnimationFrame(animate);
}

animate();
