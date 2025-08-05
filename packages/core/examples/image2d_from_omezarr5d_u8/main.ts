import {
  ChannelProps,
  Color,
  Idetik,
  ImageLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  Region,
} from "@";
import { AxesLayer } from "@/layers/axes_layer";
import { PanZoomControls } from "@/objects/cameras/controls";

const url =
  "https://public.czbiohub.org/royerlab/ultrack/multi-color/image.zarr/";
const camera = new OrthographicCamera(-2000, 2000, -2000, 2000);

// Source is technically 5D (even though Z is unitary),
// so provide indices at 3 dimensions to project to 2D.
const source = new OmeZarrImageSource(url);
const region: Region = [
  { dimension: "T", index: { type: "point", value: 150 } },
  { dimension: "C", index: { type: "point", value: 0 } },
  { dimension: "Z", index: { type: "point", value: 0 } },
  { dimension: "Y", index: { type: "full" } },
  { dimension: "X", index: { type: "full" } },
];
const channelProps: ChannelProps[] = [
  {
    color: Color.GREEN,
    contrastLimits: [0, 128],
  },
];
const layer = new ImageLayer({ source, region, channelProps });
const axes = new AxesLayer({ length: 1920, width: 0.01 });
const cameraControls = new PanZoomControls(camera);

new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("canvas")!,
  camera,
  cameraControls,
  layers: [layer, axes],
}).start();
