import {
  ChannelProps,
  Color,
  Idetik,
  ImageSeriesLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  Region,
} from "@";
import { blendMode } from "@/core/layer";
import { loadOmeroDefaultZ } from "data/ome_zarr_hcs_metadata_loader";

const url =
  "https://public.czbiohub.org/royerlab/ultrack/multi-color/image.zarr/";

// Source is 5D, so provide an interval in T a scalar index in Z
// (first of only depth) to get a 2D image series.
const source = new OmeZarrImageSource(url);

// Get the default Z index from the zattrs
let zIndex = 0;
(async () => {
  try {
    zIndex = await loadOmeroDefaultZ(url);
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
const channelProps: ChannelProps[] = [
  {
    visible: false,
    color: Color.RED,
    contrastLimits: [0, 255],
  },
  {
    visible: true,
    color: Color.BLUE,
    contrastLimits: [0, 255],
  },
  {
    visible: true,
    color: Color.GREEN,
    contrastLimits: [128, 255],
  },
];
const layer = new ImageSeriesLayer({
  source,
  region,
  seriesDimensionName: "T",
  channelProps,
});

const overlayChannelProps = structuredClone(channelProps);
overlayChannelProps[0].visible = true;
overlayChannelProps[0].color = new Color(1, 1, 0); // yellow-ish red+green
overlayChannelProps[1].visible = false;
overlayChannelProps[1].color = Color.BLUE;
overlayChannelProps[2].visible = false;
overlayChannelProps[2].color = Color.GREEN;

const overlayLayer = new ImageSeriesLayer({
  source,
  region,
  seriesDimensionName: "T",
  channelProps: overlayChannelProps,
  transparent: true,
  opacity: 0.5,
  blendMode: "normal", // just for now; you can try "additive", etc. later
});

const blendSelect = document.querySelector<HTMLSelectElement>("#blendMode");
blendSelect?.addEventListener("change", (e) => {
  overlayLayer.blendMode = (e.target as HTMLSelectElement).value as blendMode;
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
  overlayLayer.opacity = value;
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

const camera = new OrthographicCamera(0, 1920, 0, 1440);
new Idetik({
  canvasSelector: "canvas",
  camera,
  layers: [layer, overlayLayer],
}).start();
