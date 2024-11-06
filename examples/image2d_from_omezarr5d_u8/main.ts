import { vec2, vec3 } from "gl-matrix";
import {
  LayerManager,
  ImageLayer,
  WebGLRenderer,
  OmeZarrImageSource,
  OrthographicCamera,
  PerspectiveCamera,
} from "@";
import { AxesLayer } from "@/layers/axes_layer";

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

// TODO: would be nice to provide these functions in the library
const clientToWorld = (clientPos: vec2) => {
  const clipPos = renderer.clientToClip(clientPos);
  const d = camera == perspectiveCam ? clipDistance : 0;
  return camera.clipToWorld(vec3.fromValues(clipPos[0], clipPos[1], d));
};

document.addEventListener("wheel", (event) => {
  const clientPos = vec2.fromValues(event.clientX, event.clientY);
  const preZoomPos = clientToWorld(clientPos);
  if (event.deltaY < 0) {
    camera.zoom *= 1.05;
  } else {
    camera.zoom /= 1.05;
  }
  // pan to zoom in on the mouse position
  const postZoomPos = clientToWorld(clientPos);
  const dWorld = vec3.sub(vec3.create(), postZoomPos, preZoomPos);
  camera.pan(vec3.scale(vec3.create(), dWorld, -1));
  console.log(camera);
});

document.addEventListener("mousedown", (event) => {
  const clientStart = vec2.fromValues(event.clientX, event.clientY);
  let worldStart = clientToWorld(clientStart);
  console.log(clientStart, worldStart);

  const onMouseMove = (event: MouseEvent) => {
    const clientPos = vec2.fromValues(event.clientX, event.clientY);
    const worldPos = clientToWorld(clientPos);
    const dWorld = vec3.sub(vec3.create(), worldPos, worldStart);
    camera.pan(vec3.scale(vec3.create(), dWorld, -1));
    worldStart = worldPos;
  };

  const onMouseUp = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
});

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
}

animate();
