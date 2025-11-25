import {
  Idetik,
  LayerState,
  ImageSeriesLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  Region,
  Color,
} from "@";
import { LabelImageSeriesLayer } from "@/layers/label_image_series_layer";
import { PanZoomControls } from "@/objects/cameras/controls";

// These roughly correspond in terms of content and the number of time-points.
// But the image is smaller in XY than the labels, and has a Z-stack, so it
// is unclear which Z-slice the labels correspond to (if any particular one)
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

// Phase contrast limits were chosen qualitatively.
const phaseChannelIndex = 0;
const phaseContrastLimits: [number, number] = [20, 200];

const dimensionExtent = (dimensionName: string) => {
  const index = attributesAtLod.dimensionNames.findIndex(
    (d) => d === dimensionName
  );
  return {
    size: attributesAtLod.shape[index],
    scale: attributesAtLod.scale[index],
  };
};

const tExtent = dimensionExtent("T");
const tMin = 0;
const tMax = tExtent.size;
const zExtent = dimensionExtent("Z");
const zMidPoint = 0.5 * zExtent.size * zExtent.scale;

const region: Region = [
  { dimension: "T", index: { type: "full" } },
  { dimension: "C", index: { type: "point", value: phaseChannelIndex } },
  { dimension: "Z", index: { type: "point", value: zMidPoint } },
  { dimension: "X", index: { type: "full" } },
  { dimension: "Y", index: { type: "full" } },
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
      contrastLimits: phaseContrastLimits,
    },
  ],
});

imageLayer.addStateChangeCallback((newState: LayerState) => {
  stateEl.textContent = newState;
});

// Labels provide C and Z dimensions, but they are unitary.
const labelsRegion: Region = [
  { dimension: "T", index: { type: "full" } },
  { dimension: "C", index: { type: "point", value: 0 } },
  { dimension: "Z", index: { type: "point", value: 0 } },
  { dimension: "Y", index: { type: "full" } },
  { dimension: "X", index: { type: "full" } },
];

const labelsLayer = new LabelImageSeriesLayer({
  source: labelsSource,
  region: labelsRegion,
  seriesDimensionName: "T",
  transparent: true,
  opacity: 0.25,
  blendMode: "normal",
  lod,
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
  }, 20);
});

const camera = new OrthographicCamera({
  left: 0,
  right: 128,
  top: 0,
  bottom: 128,
});
const app = new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("canvas")!,
  viewports: [
    {
      camera,
      layers: [imageLayer, labelsLayer],
    },
  ],
}).start();

const viewport = app.viewports[0];

imageLayer.setIndex(tSlider.valueAsNumber);
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

document
  .querySelector<HTMLButtonElement>("#color-cycle-default")!
  .addEventListener("click", () => {
    console.debug("Resetting color map to default");
    labelsLayer.setColorMap({});
  });
document
  .querySelector<HTMLButtonElement>("#color-cycle-cmy")!
  .addEventListener("click", () => {
    console.debug("Resetting color map to CMY cycle");
    labelsLayer.setColorMap({
      cycle: [Color.CYAN, Color.MAGENTA, Color.YELLOW],
    });
  });
document
  .querySelector<HTMLButtonElement>("#color-cycle-rgb")!
  .addEventListener("click", () => {
    console.debug("Resetting color map to RGB cycle");
    labelsLayer.setColorMap({ cycle: [Color.RED, Color.GREEN, Color.BLUE] });
  });
