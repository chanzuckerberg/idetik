import { vec3 } from "gl-matrix";
import {
  ChannelProps,
  Color,
  Idetik,
  ImageLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  PerspectiveCamera,
  Region,
} from "@";
import { AxesLayer } from "@/layers/axes_layer";
import { PanZoomControls } from "@/objects/cameras/controls";

const url =
  "https://public.czbiohub.org/royerlab/ultrack/multi-color/image.zarr/";
const orthoCam = new OrthographicCamera(-2000, 2000, -2000, 2000);
const cameraPos = vec3.fromValues(0, 0, 5000);
const perspectiveCam = new PerspectiveCamera({ fov: 60, position: cameraPos });

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
const orthoCamControls = new PanZoomControls(orthoCam);
const perspectiveCamControls = new PanZoomControls(perspectiveCam);

const app = new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("canvas")!,
  camera: perspectiveCam,
  controls: perspectiveCamControls,
  layers: [layer, axes],
}).start();

document.addEventListener("keydown", (event) => {
  if (event.key === " ") {
    toggleCamera();
  }
});

function toggleCamera() {
  app.camera = app.camera === orthoCam ? perspectiveCam : orthoCam;
  app.setControls(
    app.camera === orthoCam ? orthoCamControls : perspectiveCamControls
  );
}
