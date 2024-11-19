import {
  LayerManager,
  WebGLRenderer,
  OmeZarrImageSource,
  OrthographicCamera,
} from "@";
import { Interval } from "@/data/region";
import { SubTiledImageLayer } from "@/layers/sub_tiled_image_layer";
import { PanZoomControls } from "@/objects/cameras/controls";

const url =
  "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/";
const layerManager = new LayerManager();
const renderer = new WebGLRenderer("#canvas");
// This incorporates the shape and scale of the highest resolution image.
const camera = new OrthographicCamera(0, 2423 * 0.439, 2174 * 0.439, 0);

const controls = new PanZoomControls(camera, camera.position);
renderer.setControls(controls);

// Source is 5D, so provide indices at 3 dimensions to project to 2D.
const source = new OmeZarrImageSource(url);
const region = new Map<string, Interval | number>([
  ["t", 400],
  ["c", 0],
  ["z", 300],
]);
const layer = new SubTiledImageLayer(source, region);
layerManager.add(layer);

function animate() {
  renderer.render(layerManager, camera);
  requestAnimationFrame(animate);
}

animate();
