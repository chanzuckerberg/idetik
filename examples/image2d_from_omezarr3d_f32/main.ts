import {
  LayerManager,
  ImageLayer,
  OrthographicCamera,
  WebGLRenderer,
  OmeZarrImageSource,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";

const url =
  "https://files.cryoetdataportal.cziscience.com/10444/24apr23a_Position_12/Reconstructions/VoxelSpacing4.990/Tomograms/100/24apr23a_Position_12.zarr";
const layerManager = new LayerManager();
const renderer = new WebGLRenderer("#canvas");
const camera = new OrthographicCamera(0, 19.96 * 316, 0, 19.96 * 316);
const controls = new PanZoomControls(camera, camera.position);
renderer.setControls(controls);
const region = [{ dimension: "z", index: 0.5 * 19.96 * 93 }];

const source = new OmeZarrImageSource(url);
const layer = new ImageLayer(source, region);
layerManager.add(layer);

function animate() {
  renderer.render(layerManager, camera);
  requestAnimationFrame(animate);
}

animate();
