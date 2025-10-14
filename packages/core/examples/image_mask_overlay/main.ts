import {
  Idetik,
  LayerState,
  ImageSeriesLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  Region,
  ChannelProps,
  Color,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";

const baseUrl =
  "https://files.cryoetdataportal.cziscience.com/10444/24apr23a_Position_12/Reconstructions/VoxelSpacing4.990";
const imageUrl = `${baseUrl}/Tomograms/100/24apr23a_Position_12.zarr`;
const maskUrl = `${baseUrl}/Annotations/100/membrane-1.0_segmentationmask.zarr`;

// Source is 3D with axes (z, y, x), so we provide an interval in z
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
const region: Region = [
  { dimension: zDimName, index: { type: "full" } },
  { dimension: "x", index: { type: "full" } },
  { dimension: "y", index: { type: "full" } },
];

// This dataset is grayscale electron microscopy data
const channelProps: ChannelProps[] = [
  {
    visible: true,
    color: Color.WHITE,
    contrastLimits: [-0.00001, 0.00001],
  },
];

const imageLayer = new ImageSeriesLayer({
  source: imageSource,
  region,
  seriesDimensionName: zDimName,
  channelProps,
});

imageLayer.addStateChangeCallback((newState: LayerState) => {
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
      contrastLimits: [0, 1],
    },
  ],
  transparent: true,
  opacity: 0.5,
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
  canvas: document.querySelector<HTMLCanvasElement>("canvas")!,
  viewports: [
    {
      camera,
      layers: [imageLayer, maskLayer],
    },
  ],
}).start();

const viewport = app.viewports[0];

imageLayer.setIndex(zSlider.valueAsNumber);
const setCameraFrame = (newState: LayerState) => {
  if (newState === "ready" && imageLayer.extent !== undefined) {
    camera.setFrame(0, imageLayer.extent.x, 0, imageLayer.extent.y);
    viewport.cameraControls = new PanZoomControls(camera);
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
  await maskLayer.preloadSeries();
  loadAllButton.value = "Loaded all slices";
}

async function setLayerIndex(index: number) {
  zIndexEl!.textContent = "...";
  const imageResult = await imageLayer.setIndex(index);
  const maskResult = await maskLayer.setIndex(index);
  if (imageResult.success && maskResult.success) {
    zIndexEl!.textContent = `${index}`;
  }
}
