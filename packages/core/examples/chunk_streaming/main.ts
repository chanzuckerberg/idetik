import {
  Idetik,
  ImageLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  Region,
} from "@";
import { Point } from "@/data/region";
import { PanZoomControls } from "@/objects/cameras/controls";
import GUI from "lil-gui";

const url =
  "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/";
const left = 150;
const right = 950;
const top = 100;
const bottom = 900;

// Source is 5D, so provide indices at 3 dimensions to project to 2D.
// Also specify a subregion in x and y to exercise that part of the API.
const source = new OmeZarrImageSource(url);

const region: Region = [
  { dimension: "t", index: { type: "point", value: 400 } },
  { dimension: "c", index: { type: "point", value: 0 } },
  { dimension: "z", index: { type: "point", value: 300 } },
  { dimension: "y", index: { type: "full" } },
  { dimension: "x", index: { type: "full" } },
];

const zIndex = region[2].index as Point;
const zRange = { min: 0, max: 448 }; // max value taken from source
const gui = new GUI({ width: 500 });
gui.add(zIndex, "value", zRange.min, zRange.max, 1).name("Z-index");

const channelProps = [{ contrastLimits: [0, 255] as [number, number] }];
const camera = new OrthographicCamera(left, right, top, bottom);
const imageLayer = new ImageLayer({ source, region, channelProps });
imageLayer.debugMode = true;

new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("#canvas")!,
  camera,
  cameraControls: new PanZoomControls(camera),
  layers: [imageLayer],
  overlays: [],
  showStats: true,
}).start();
