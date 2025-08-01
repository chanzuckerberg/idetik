import {
  Color,
  Idetik,
  ImageLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  Region,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";
import { FpsOverlay } from "./fps_overlay";
import { ChunkInfoOverlay } from "./chunk_info_overlay";

const url =
  "https://ome-zarr-scivis.s3.us-east-1.amazonaws.com/v0.5/96x2/marmoset_neurons.ome.zarr";
const shape = {
  x: 1024,
  y: 1024,
  z: 314,
};
const scale = {
  x: 0.497,
  y: 0.497,
  z: 1.5,
};
const offset = {
  x: -254.464,
  y: -254.464,
  z: -235.5,
};
const left = offset.x;
const right = offset.x + shape.x * scale.x;
const top = offset.y;
const bottom = offset.y + shape.y * scale.y;
const zMid = offset.z + 0.5 * shape.z * scale.z;

const source = new OmeZarrImageSource(url);
const region: Region = [
  { dimension: "z", index: { type: "point", value: zMid } },
  { dimension: "y", index: { type: "full" } },
  { dimension: "x", index: { type: "full" } },
];
const channelProps = [
  {
    visible: true,
    color: Color.WHITE,
    contrastLimits: [0, 255] as [number, number],
  },
];
const imageLayer = new ImageLayer({ source, region, channelProps });
imageLayer.debugMode = true;
const camera = new OrthographicCamera(left, right, top, bottom);
const fpsOverlay = new FpsOverlay({
  textDiv: document.querySelector<HTMLDivElement>("#fps-text")!,
});
const chunkInfoOverlay = new ChunkInfoOverlay({
  textDiv: document.querySelector<HTMLDivElement>("#chunk-info")!,
  imageLayer: imageLayer,
});

new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("#canvas")!,
  camera,
  controls: new PanZoomControls(camera, camera.position),
  layers: [imageLayer],
  overlays: [fpsOverlay, chunkInfoOverlay],
}).start();
