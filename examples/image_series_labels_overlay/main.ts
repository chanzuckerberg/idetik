import {
  Idetik,
  LayerState,
  ImageLayer,
  LabelLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  Color,
  PointPickingResult,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";
import { createExplorationPolicy } from "@/core/image_source_policy";

// These roughly correspond in terms of content and the number of time-points.
// But the image is smaller in XY than the labels, and has a Z-stack, so it
// is unclear which Z-slice the labels correspond to (if any particular one)
const baseUrl = "https://public.czbiohub.org/organelle_box/datasets/A549";
const fovName = "B/3/000000";
const imageUrl = `${baseUrl}/2024_11_07_A549_SEC61_DENV_cropped.zarr/${fovName}`;
const labelsUrl = `${baseUrl}/2024_11_07_A549_SEC61_DENV_tracking.zarr/${fovName}`;

const imageSource = OmeZarrImageSource.fromHttp({ url: imageUrl });
const labelsSource = OmeZarrImageSource.fromHttp({ url: labelsUrl });

const lod = 0;
const loader = await imageSource.open();
const dimensions = loader.getSourceDimensionMap();

const tLod = dimensions.t!.lods[lod];
const tMin = 0;
const tMax = tLod.size;
const tScale = tLod.scale;
const zLod = dimensions.z!.lods[lod];
const zMidPoint = 0.5 * zLod.size * zLod.scale;
const xLod = dimensions.x!.lods[lod];
const xStopPoint = xLod.size * xLod.scale;
const yLod = dimensions.y!.lods[lod];
const yStopPoint = yLod.size * yLod.scale;

const sliceCoords = {
  t: tMin * tScale,
  c: [0],
  z: zMidPoint,
};

// Labels have unitary C and Z dimensions.
const labelsSliceCoords = {
  t: tMin * tScale,
  c: [0],
};

const imageLayer = new ImageLayer({
  source: imageSource,
  sliceCoords,
  policy: createExplorationPolicy(),
  channelProps: [
    {
      visible: true,
      color: Color.WHITE,
      contrastLimits: [20, 200],
    },
  ],
});

imageLayer.addStateChangeCallback((newState: LayerState) => {
  stateEl.textContent = newState;
});

const pickInfoEl = document.querySelector<HTMLDivElement>("#pick-info")!;
let outlineMode = false;

function createLabelsLayer() {
  return new LabelLayer({
    source: labelsSource,
    sliceCoords: labelsSliceCoords,
    policy: createExplorationPolicy(),
    transparent: true,
    opacity: 0.25,
    blendMode: "normal",
    outlineSelected: outlineMode,
    onPickValue: (info: PointPickingResult) => {
      const { world, value } = info;
      pickInfoEl.innerHTML = `
        World: (${world[0].toFixed(1)}, ${world[1].toFixed(1)}, ${world[2].toFixed(1)})<br/>
        Label: ${value}
      `;
      if (!outlineMode) {
        labelsLayer.setColorMap({
          cycle: Array.from(labelsLayer.colorMap.cycle),
          lookupTable: new Map([[value, Color.WHITE]]),
        });
      }
    },
  });
}

let labelsLayer = createLabelsLayer();

const tSlider = document.querySelector<HTMLInputElement>("#t-slider")!;
const tIndexEl = document.querySelector<HTMLSpanElement>("#t-index")!;
const tTotalEl = document.querySelector<HTMLSpanElement>("#t-total")!;
const stateEl = document.querySelector<HTMLSpanElement>("#layer-state")!;
const outlineToggleEl =
  document.querySelector<HTMLButtonElement>("#outline-toggle")!;

// Initialize slider
tSlider.min = `${tMin}`;
tSlider.max = `${tMax - 1}`;
tSlider.value = "0";
tTotalEl.textContent = `${tMax - tMin - 1}`;

let debounce: ReturnType<typeof setTimeout>;
tSlider.addEventListener("input", (event) => {
  clearTimeout(debounce);
  const value = (event.target as HTMLInputElement).valueAsNumber;
  debounce = setTimeout(() => {
    setTimeIndex(value);
  }, 20);
});

const camera = new OrthographicCamera(0, xStopPoint, 0, yStopPoint);
const idetik = new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("canvas")!,
  viewports: [
    {
      camera,
      cameraControls: new PanZoomControls(camera),
      layers: [imageLayer, labelsLayer],
    },
  ],
});

const viewport = idetik.viewports[0];

outlineToggleEl.addEventListener("click", () => {
  outlineMode = !outlineMode;
  outlineToggleEl.textContent = outlineMode ? "Outline" : "Fill";
  viewport.layerManager.remove(labelsLayer);
  labelsLayer = createLabelsLayer();
  viewport.layerManager.add(labelsLayer);
});

function setTimeIndex(index: number) {
  sliceCoords.t = index * tScale;
  labelsSliceCoords.t = index * tScale;
  tIndexEl.textContent = `${index}`;
}

document
  .querySelector<HTMLButtonElement>("#color-cycle-default")!
  .addEventListener("click", () => {
    labelsLayer.setColorMap({});
  });
document
  .querySelector<HTMLButtonElement>("#color-cycle-cmy")!
  .addEventListener("click", () => {
    labelsLayer.setColorMap({
      cycle: [Color.CYAN, Color.MAGENTA, Color.YELLOW],
    });
  });
document
  .querySelector<HTMLButtonElement>("#color-cycle-rgb")!
  .addEventListener("click", () => {
    labelsLayer.setColorMap({ cycle: [Color.RED, Color.GREEN, Color.BLUE] });
  });

idetik.start();
