import {
  LayerManager,
  PerspectiveCamera,
  SingleMeshLayer,
  WebGLRenderer,
} from "@";

const singleMeshLayer = new SingleMeshLayer();
const layersManager = new LayerManager();
layersManager.add(singleMeshLayer);

const renderer = new WebGLRenderer("#canvas");
const camera = new PerspectiveCamera(60, renderer.width / renderer.height);

function animate() {
  renderer.render(layersManager, camera);
  requestAnimationFrame(animate);
}

animate();
