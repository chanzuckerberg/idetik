import {
  Idetik,
  ImageLayerXYZ,
  OmeZarrImageSource,
  OrthographicCamera,
  Region,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";

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
const channelProps = [{ contrastLimits: [0, 255] as [number, number] }];
const layer = new ImageLayerXYZ({ source, region, channelProps });
const camera = new OrthographicCamera(left, right, top, bottom);

new Idetik({
  canvasSelector: "canvas",
  camera,
  controls: new PanZoomControls(camera, camera.position),
  layers: [layer],
}).start();
