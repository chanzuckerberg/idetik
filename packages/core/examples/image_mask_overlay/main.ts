import {
  Idetik,
  LayerState,
  OmeZarrImageSource,
  OrthographicCamera,
  Region,
  Color,
  ImageSeriesLayer,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";

const imageUrl =
  "https://files.cryoetdataportal.cziscience.com/10000/TS_041/Reconstructions/VoxelSpacing13.480/Tomograms/100/TS_041.zarr";
const labelsUrl =
  "https://files.cryoetdataportal.cziscience.com/10000/TS_041/Reconstructions/VoxelSpacing13.480/Annotations/114/membrane-1.0_segmentationmask.zarr";

const imageSource = new OmeZarrImageSource(imageUrl);
const labelsSource = new OmeZarrImageSource(labelsUrl);

const loader = await imageSource.open();
const attributes = await loader.loadAttributes();
const lods = attributes.length;
const attributesForLastLod = attributes[lods - 1];

const zDimName = "z";
const zAxisIndex = attributesForLastLod.dimensionNames.findIndex(
  (dim) => dim === zDimName
);
const zMin = 0;
const zMax = attributesForLastLod.shape[zAxisIndex];

const region: Region = [
  { dimension: zDimName, index: { type: "full" } },
  { dimension: "x", index: { type: "full" } },
  { dimension: "y", index: { type: "full" } },
];

const imageLayer = new ImageSeriesLayer({
  source: imageSource,
  region,
  seriesDimensionName: zDimName,
  channelProps: [
    {
      visible: true,
      color: Color.WHITE,
      contrastLimits: [-10, 10],
    },
  ],
});

const labelsLayer = new ImageSeriesLayer({
  source: labelsSource,
  region,
  seriesDimensionName: zDimName,
  channelProps: [
    {
      visible: true,
      color: Color.RED,
      contrastLimits: [0, 1],
    },
  ],
  transparent: true,
  opacity: 0.5,
  blendMode: "normal",
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
