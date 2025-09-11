import "./modulepreload-polyfill-DaKOjhqt.js";
import { C as Color, I as Idetik } from "./metadata_loaders-CXLkXwNR.js";
import { O as OmeZarrImageSource, a as OrthographicCamera } from "./image_source-BemCU8_Z.js";
import { I as ImageSeriesLayer } from "./image_series_layer-xl760NUg.js";
const url = "https://public.czbiohub.org/royerlab/ultrack/multi-color/image.zarr/";
const source = new OmeZarrImageSource(url);
const timeInterval = { start: 100, stop: 120 };
const region = [
  { dimension: "T", index: { type: "interval", ...timeInterval } },
  { dimension: "C", index: { type: "full" } },
  { dimension: "Z", index: { type: "point", value: 0 } },
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
    color: Color.GREEN,
    contrastLimits: [0, 255]
  },
  {
    visible: true,
    color: Color.BLUE,
    contrastLimits: [128, 255]
  }
];
const layer = new ImageSeriesLayer({
  source,
  region,
  seriesDimensionName: "T",
  channelProps
});
const slider = document.querySelector("#slider");
if (slider === null) throw new Error("Time slider not found.");
slider.min = `${timeInterval.start}`;
slider.max = `${timeInterval.stop - 1}`;
slider.addEventListener("input", (event) => {
  const value = event.target.valueAsNumber;
  const index = value - timeInterval.start;
  layer.setIndex(index);
});
layer.setIndex(slider.valueAsNumber - timeInterval.start);
layer.preloadSeries();
new Idetik({
  canvas: document.querySelector("canvas"),
  camera: new OrthographicCamera(0, 1920, 0, 1440),
  layers: [layer]
}).start();
//# sourceMappingURL=image_series_from_omezarr5d_u8-BRK9QGtZ.js.map
