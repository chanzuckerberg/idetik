import {
  Idetik,
  ImageLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  Region,
} from "@";
import { AxesLayer } from "@/layers/axes_layer";
import { PanZoomControls } from "@/objects/cameras/controls";
import { ScaleBar } from "./scale_bar";

const url =
  "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/";
const left = 150;
const right = 950;
const top = 100;
const bottom = 900;

// Source is 5D, so provide indices at 3 dimensions to project to 2D.
// Also specify a subregion in x and y to exercise that part of the API.
const source = OmeZarrImageSource.fromHttp({ url });
const region: Region = [
  { dimension: "t", index: { type: "point", value: 400 } },
  { dimension: "c", index: { type: "point", value: 0 } },
  { dimension: "z", index: { type: "point", value: 300 } },
  { dimension: "y", index: { type: "interval", start: top, stop: bottom } },
  { dimension: "x", index: { type: "interval", start: left, stop: right } },
];
const channelProps = [{ contrastLimits: [0, 255] as [number, number] }];
const layer = new ImageLayer({ source, region, channelProps });
const axes = new AxesLayer({ length: 2000, width: 0.01 });
const camera = new OrthographicCamera(left, right, top, bottom);
const scaleBar = new ScaleBar({
  textDiv: document.querySelector<HTMLDivElement>("#scale-bar-text")!,
  lineDiv: document.querySelector<HTMLDivElement>("#scale-bar-line")!,
  unit: "μm",
});

new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("canvas")!,
  viewports: [
    {
      camera,
      cameraControls: new PanZoomControls(camera),
      layers: [layer, axes],
    },
  ],
  overlays: [scaleBar],
}).start();
