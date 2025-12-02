import {
  ChannelProps,
  Color,
  Idetik,
  ImageSeriesLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  Region,
} from "@";

const url =
  "https://public.czbiohub.org/royerlab/ultrack/multi-color/image.zarr/";
// Source is 5D, so provide an interval in T a scalar index in Z
// (first of only depth) to get a 2D image series.
const source = OmeZarrImageSource.fromHttp({ url });
const timeInterval = { start: 100, stop: 120 };
const region: Region = [
  { dimension: "T", index: { type: "interval", ...timeInterval } },
  { dimension: "C", index: { type: "full" } },
  { dimension: "Z", index: { type: "point", value: 0 } },
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
    color: Color.GREEN,
    contrastLimits: [0, 255],
  },
  {
    visible: true,
    color: Color.BLUE,
    contrastLimits: [128, 255],
  },
];
const layer = new ImageSeriesLayer({
  source,
  region,
  seriesDimensionName: "T",
  channelProps,
});

const slider = document.querySelector<HTMLInputElement>("#slider");
if (slider === null) throw new Error("Time slider not found.");
slider.min = `${timeInterval.start}`;
slider.max = `${timeInterval.stop - 1}`;

slider.addEventListener("input", (event) => {
  const value = (event.target as HTMLInputElement).valueAsNumber;
  const index = value - timeInterval.start;
  layer.setIndex(index);
});

layer.setIndex(slider.valueAsNumber - timeInterval.start);
layer.preloadSeries();

new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("canvas")!,
  viewports: [
    {
      camera: new OrthographicCamera(0, 1920, 0, 1440),
      layers: [layer],
    },
  ],
}).start();
