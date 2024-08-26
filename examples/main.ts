import {
  LayerManager,
  PerspectiveCamera,
  SingleMeshLayer,
  WebGLRenderer,
} from "@";

const singleMeshLayer = new SingleMeshLayer();
const layersManager = new LayerManager();
layersManager.add(singleMeshLayer);

const camera = new PerspectiveCamera();
const renderer = new WebGLRenderer("#canvas");

function animate() {
  requestAnimationFrame(animate);
  renderer.render(layersManager, camera);
}

animate();
