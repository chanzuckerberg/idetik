import {
  LayerManager,
  ImageLayer,
  OrthographicCamera,
  WebGLRenderer,
  OmeZarrImageSource,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";

// From https://zenodo.org/records/11262587
// const url = "http://127.0.0.1:8081/20200812-CardiomyocyteDifferentiation14-Cycle1_mip.zarr/";
const url = "http://127.0.0.1:8081/20200812-CardiomyocyteDifferentiation14-Cycle1_mip.zarr/B/03/0/";
const layerManager = new LayerManager();
const renderer = new WebGLRenderer("#canvas");
const camera = new OrthographicCamera(0, 1920, 0, 1440, 0, 10000);
const controls = new PanZoomControls(camera, camera.position);
renderer.setControls(controls);
const source = new OmeZarrImageSource(url);
const region = [
  { dimension: "c", index: 0 },
  { dimension: "z", index: 0 },
];
const layer = new ImageLayer(source, region);
layerManager.add(layer);

function animate() {
  renderer.render(layerManager, camera);
  requestAnimationFrame(animate);
}

animate();
