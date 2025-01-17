import {
  LayerManager,
  ResponsiveImageLayer,
  WebGLRenderer,
  OmeZarrImageSource,
  OrthographicCamera,
} from "@";
import { AxesLayer } from "@/layers/axes_layer";
import { PanZoomControls } from "@/objects/cameras/controls";

// loading from zarr-testcard server
const url = "http://127.0.0.1:8000/default/";
const layerManager = new LayerManager();
const renderer = new WebGLRenderer("#canvas");
const camera = new OrthographicCamera(-128, 128, -128, 128);
const panZoomControls = new PanZoomControls(camera);
renderer.setControls(panZoomControls);

// Source is technically 5D (even though Z is unitary),
// so provide indices at 3 dimensions to project to 2D.
const source = new OmeZarrImageSource(url);
const region = [
  { dimension: "T", index: 32 },
  { dimension: "C", index: 0 },
  { dimension: "Z", index: 640 },
];
const layer = new ResponsiveImageLayer(source, region, camera, renderer);
const axes = new AxesLayer({ length: 2048, width: 0.01 });
layerManager.add(layer);
layerManager.add(axes);

document.addEventListener("keydown", (event) => {
  // TODO: add a callback to update on camera change
  if (event.key === " ") {
    layer.onCameraFrameChange();
  }
});

function animate() {
  renderer.render(layerManager, camera);
  requestAnimationFrame(animate);
}

animate();
