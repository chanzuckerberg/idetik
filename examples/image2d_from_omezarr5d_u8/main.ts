import { vec3 } from "gl-matrix";
import {
  LayerManager,
  ImageLayer,
  WebGLRenderer,
  OmeZarrImageSource,
  OrthographicCamera,
  PerspectiveCamera,
} from "@";
import { AxesLayer } from "@/layers/axes_layer";
import { PanZoomControls } from "@/objects/cameras/controls";

const url =
  "https://public.czbiohub.org/royerlab/ultrack/multi-color/image.zarr/";
const layerManager = new LayerManager();
const renderer = new WebGLRenderer("#canvas");
const orthoCam = new OrthographicCamera(-2000, 2000, -2000, 2000);
const perspectiveCam = new PerspectiveCamera(60, 1, 0.1, 10000);
const cameraPos = vec3.fromValues(0, 0, 5000);
perspectiveCam.transform.translate(cameraPos);
// project the (negative) camera position to clip space
// to get the distance to the image plane (z = 0)
const projectedCameraPos = vec3.transformMat4(
  vec3.create(),
  vec3.scale(vec3.create(), cameraPos, -1),
  perspectiveCam.projectionMatrix
);
const clipDistance = projectedCameraPos[2];

// Source is technically 5D (even though Z is unitary),
// so provide indices at 3 dimensions to project to 2D.
const source = new OmeZarrImageSource(url);
const region = [
  { dimension: "T", index: 150 },
  { dimension: "C", index: 0 },
  { dimension: "Z", index: 0 },
];
const layer = new ImageLayer(source, region);

const axes = new AxesLayer({ length: 1920, width: 0.01 });
layerManager.add(layer);
layerManager.add(axes);

let camera: PerspectiveCamera | OrthographicCamera = perspectiveCam;

const orthoCamControls = new PanZoomControls(orthoCam);
const perspectiveCamControls = new PanZoomControls(
  perspectiveCam,
  clipDistance
);

renderer.setControls(perspectiveCamControls);

function animate() {
  renderer.render(layerManager, camera);
  requestAnimationFrame(animate);
}

document.addEventListener("keydown", (event) => {
  if (event.key === " ") {
    toggleCamera();
  }
});

function toggleCamera() {
  camera = camera === orthoCam ? perspectiveCam : orthoCam;
  renderer.setControls(
    camera === orthoCam ? orthoCamControls : perspectiveCamControls
  );
}

animate();
