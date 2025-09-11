import "./modulepreload-polyfill-DaKOjhqt.js";
import { b as loadOmeroDefaults, C as Color, I as Idetik } from "./metadata_loaders-CXLkXwNR.js";
import { O as OmeZarrImageSource, a as OrthographicCamera } from "./image_source-BemCU8_Z.js";
import { I as ImageSeriesLayer } from "./image_series_layer-xl760NUg.js";
const url = "https://public.czbiohub.org/royerlab/ultrack/multi-color/image.zarr/";
const source = new OmeZarrImageSource(url);
let zIndex = 0;
(async () => {
  try {
    const defaults = await loadOmeroDefaults(source);
    zIndex = defaults?.defaultZ ?? 0;
  } catch (error) {
    console.error("Error loading default Z index:", error);
  }
})();
const timeInterval = { start: 100, stop: 120 };
const region = [
  { dimension: "T", index: { type: "interval", ...timeInterval } },
  { dimension: "C", index: { type: "full" } },
  { dimension: "Z", index: { type: "point", value: zIndex } },
  { dimension: "Y", index: { type: "full" } },
  { dimension: "X", index: { type: "full" } }
];
const channelProps = [
  {
    visible: false,
    color: Color.RED,
    contrastLimits: [0, 255]
  },
  {
    visible: true,
    color: Color.BLUE,
    contrastLimits: [0, 255]
  },
  {
    visible: true,
    color: Color.GREEN,
    contrastLimits: [128, 255]
  }
];
const layer = new ImageSeriesLayer({
  source,
  region,
  seriesDimensionName: "T",
  channelProps
});
const overlayChannelProps = structuredClone(channelProps);
overlayChannelProps[0].visible = true;
overlayChannelProps[0].color = new Color(1, 1, 0);
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
  blendMode: "normal"
  // just for now; you can try "additive", etc. later
});
const blendSelect = document.querySelector("#blendMode");
blendSelect?.addEventListener("change", (e) => {
  overlayLayer.blendMode = e.target.value;
});
const slider = document.querySelector("#slider");
if (slider === null) throw new Error("Time slider not found.");
slider.min = `${timeInterval.start}`;
slider.max = `${timeInterval.stop - 1}`;
const opacitySlider = document.querySelector("#opacitySlider");
if (!opacitySlider) throw new Error("Opacity slider not found.");
opacitySlider.addEventListener("input", (event) => {
  const value = event.target.valueAsNumber;
  overlayLayer.opacity = value;
});
slider.addEventListener("input", (event) => {
  const value = event.target.valueAsNumber;
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
  canvas: document.querySelector("canvas"),
  camera,
  layers: [layer, overlayLayer]
}).start();
//# sourceMappingURL=layer_blending-BQ44lndK.js.map
