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

const url = "http://127.0.0.1:8080/kermit-momo-like-0_5.zarr/";
const left = 0;
const right = 3024;
const top = 0;
const bottom = 4032;

const source = new OmeZarrImageSource(url);
const region: Region = [
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
