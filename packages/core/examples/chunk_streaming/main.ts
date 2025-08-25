import {
  Idetik,
  ChunkImageLayer,
  OmeZarrImageSource,
  OrthographicCamera,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";
import { ChunkInfoOverlay } from "./chunk_info_overlay";
import GUI from "lil-gui";
import { Region2D } from "@/data/chunk";

const url =
  "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/";
const left = 150;
const right = 950;
const top = 100;
const bottom = 900;

// Source is 5D, so provide indices at 3 dimensions to project to 2D.
// Also specify a subregion in x and y to exercise that part of the API.
const source = new OmeZarrImageSource(url);

const region: Region2D = {
  t: 400,
  z: 300,
  c: 0,
};

const channelProps = [{ contrastLimits: [0, 255] as [number, number] }];
const camera = new OrthographicCamera(left, right, top, bottom);
const imageLayer = new ChunkImageLayer({ source, region, channelProps });
imageLayer.debugMode = true;

const overlaySelector = document.querySelector<HTMLDivElement>("#chunk-info")!;
const chunkInfoOverlay = new ChunkInfoOverlay({
  textDiv: overlaySelector,
  imageLayer: imageLayer,
});

new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("#canvas")!,
  camera,
  cameraControls: new PanZoomControls(camera),
  layers: [imageLayer],
  overlays: [chunkInfoOverlay],
  showStats: true,
}).start();

const controls = {
  region,
  showWireframes: true,
  showChunkInfoOverlay: true,
};

// values copied from source
const z = { translate: 0.0, scale: 1.24, shape: 448 };
const min = z.translate;
const max = z.translate + z.scale * z.shape - z.scale;
const zRange = { min, max };
const gui = new GUI({ width: 500 });

gui.add(controls.region, "z", zRange.min, zRange.max, z.scale).name("Z-point");

gui
  .add(controls, "showWireframes")
  .name("Show tile wireframes")
  .onChange((show: boolean) => (imageLayer.debugMode = show));

gui
  .add(controls, "showChunkInfoOverlay")
  .name("Show chunk information overlay")
  .onChange((show: boolean) => {
    overlaySelector.style.display = show ? "block" : "none";
  });
