import {
  LayerManager,
  LayerState,
  ImageSeriesLayer,
  OrthographicCamera,
  WebGLRenderer,
  OmeZarrImageSource,
} from "@";

const url =
  "https://public.czbiohub.org/royerlab/ultrack/multi-color/image.zarr/";
const layerManager = new LayerManager();
const renderer = new WebGLRenderer("#canvas");
const camera = new OrthographicCamera(0, 1920, 0, 1440);

// Source is 5D, so provide an interval in T and C (all three channels)
// and scalar indices in Z (first of only depth) to get a 2D image series.
const source = new OmeZarrImageSource(url);
const timeInterval = { start: 100, stop: 120 };
const channels = { start: 0, stop: 3 };
const region = [
  { dimension: "T", index: timeInterval },
  { dimension: "C", index: channels },
  { dimension: "Z", index: 0 },
];
// Raise the contrast limits for the blue channel because there is
// a lot of low signal.
const channelProps = [
  { contrastLimits: [0, 255] as [number, number] },
  { contrastLimits: [0, 255] as [number, number] },
  { contrastLimits: [128, 255] as [number, number] },
];
const layer = new ImageSeriesLayer({
  source,
  region,
  timeDimension: "T",
  channelProps,
});
layerManager.add(layer);

const slider = document.querySelector<HTMLInputElement>("#slider");
if (slider === null) throw new Error("Time slider not found.");
slider.min = timeInterval.start.toString();
slider.max = (timeInterval.stop - 1).toString();

layer.addStateChangeCallback((newState: LayerState) => {
  if (newState === "ready") {
    slider.addEventListener("input", (event) => {
      const value = (event.target as HTMLInputElement).valueAsNumber;
      layer.setTimeIndex(value);
    });
    layer.setTimeIndex(slider.valueAsNumber);
  }
});

function animate() {
  renderer.render(layerManager, camera);
  requestAnimationFrame(animate);
}

animate();
