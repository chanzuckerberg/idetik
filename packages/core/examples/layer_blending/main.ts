import {
  ImageSeriesLayer,
  LayerManager,
  OmeZarrImageSource,
  OrthographicCamera,
  Region,
  WebGLRenderer,
} from "@";
import { BlendingMode } from "@/core/layer";
import { loadOmeroDefaultZ } from "data/ome_zarr_hcs_metadata_loader";

const url =
  "https://public.czbiohub.org/royerlab/ultrack/multi-color/image.zarr/";
const layerManager = new LayerManager();
const renderer = new WebGLRenderer("#canvas");
const camera = new OrthographicCamera(0, 1920, 0, 1440);

// Source is 5D, so provide an interval in T a scalar index in Z
// (first of only depth) to get a 2D image series.
const source = new OmeZarrImageSource(url);

// Get the default Z index from the zattrs
let zIndex = 0;
(async () => {
  try {
    zIndex = await loadOmeroDefaultZ(url);
    console.log("Default Z index:", zIndex);
  } catch (error) {
    console.error("Error loading default Z index:", error);
  }
})();

const timeInterval = { start: 100, stop: 120 };
const region: Region = [
  { dimension: "T", index: { type: "interval", ...timeInterval } },
  { dimension: "C", index: { type: "full" } },
  { dimension: "Z", index: { type: "point", value: zIndex } },
  { dimension: "Y", index: { type: "full" } },
  { dimension: "X", index: { type: "full" } },
];
// Raise the contrast limits for the blue channel because there is
// a lot of low signal that washes everything else out.
const channelProps = [
  {
    visible: false,
    color: [1, 0, 0] as [number, number, number],
    contrastLimits: [0, 255] as [number, number],
  },
  {
    visible: true,
    color: [0, 1, 0] as [number, number, number],
    contrastLimits: [0, 255] as [number, number],
  },
  {
    visible: true,
    color: [0, 0, 1] as [number, number, number],
    contrastLimits: [128, 255] as [number, number],
  },
];
const layer = new ImageSeriesLayer({
  source,
  region,
  seriesDimensionName: "T",
  channelProps,
  zIndex,
});
layerManager.add(layer);

const overlayChannelProps = [
  {
    visible: true,
    color: [1, 1, 0] as [number, number, number], // yellow-ish red+green
    contrastLimits: [0, 255] as [number, number],
  },
  {
    visible: false,
    color: [0, 0, 0] as [number, number, number],
    contrastLimits: [0, 255] as [number, number],
  },
  {
    visible: false,
    color: [0, 0, 0] as [number, number, number],
    contrastLimits: [128, 255] as [number, number],
  },
];

const overlayLayer = new ImageSeriesLayer({
  source,
  region,
  seriesDimensionName: "T",
  channelProps: overlayChannelProps,
  isTransparent: true,
  opacity: 0.5,
  blendingMode: "normal", // just for now; you can try "additive", etc. later
});
layerManager.add(overlayLayer);

const blendSelect = document.querySelector<HTMLSelectElement>("#blendMode");
blendSelect?.addEventListener("change", (e) => {
  overlayLayer.setBlendingMode(
    (e.target as HTMLSelectElement).value as BlendingMode
  );
});

const slider = document.querySelector<HTMLInputElement>("#slider");
if (slider === null) throw new Error("Time slider not found.");
slider.min = `${timeInterval.start}`;
slider.max = `${timeInterval.stop - 1}`;

const opacitySlider =
  document.querySelector<HTMLInputElement>("#opacitySlider");
if (!opacitySlider) throw new Error("Opacity slider not found.");

opacitySlider.addEventListener("input", (event) => {
  const value = (event.target as HTMLInputElement).valueAsNumber;
  overlayLayer.setOpacity(value);
});

slider.addEventListener("input", (event) => {
  const value = (event.target as HTMLInputElement).valueAsNumber;
  const index = value - timeInterval.start;
  layer.setIndex(index);
  overlayLayer.setIndex(index);
});

layer.setIndex(slider.valueAsNumber - timeInterval.start);
overlayLayer.setIndex(slider.valueAsNumber - timeInterval.start);

layer.preloadSeries();
overlayLayer.preloadSeries();

function animate() {
  renderer.render(layerManager, camera);
  requestAnimationFrame(animate);
}

animate();
