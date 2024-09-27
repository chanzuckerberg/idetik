import {
  LayerManager,
  OrthographicCamera,
  SingleMeshLayer,
  WebGLRenderer,
} from "@";

const singleMeshLayer = new SingleMeshLayer();
const layersManager = new LayerManager();
layersManager.add(singleMeshLayer);

const renderer = new WebGLRenderer("#canvas");

const camera = new OrthographicCamera(
  -renderer.width / 2,
  renderer.width / 2,
  -renderer.height / 2,
  renderer.height / 2
);

function animate() {
  renderer.render(layersManager, camera);
  requestAnimationFrame(animate);
}

animate();
