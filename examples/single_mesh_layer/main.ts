import {
  LayerManager,
  // OrthographicCamera,
  PerspectiveCamera,
  SingleMeshLayer,
  WebGLRenderer,
} from "@";
import { AxesLayer } from "@/layers/axes_layer";

const singleMeshLayer = new SingleMeshLayer();
const layersManager = new LayerManager();

const renderer = new WebGLRenderer("#canvas");
// const camera = new OrthographicCamera(-100, 1000, -100, 1000);
const camera = new PerspectiveCamera(60);
camera.transform.translate([500, 500, 900]);

const axes = new AxesLayer({ length: 870, width: 10 });
layersManager.add(singleMeshLayer);
layersManager.add(axes);

function animate() {
  renderer.render(layersManager, camera);
  requestAnimationFrame(animate);
}

animate();
