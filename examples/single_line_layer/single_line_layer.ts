import {
  LayerManager,
  PerspectiveCamera,
  // SingleMeshLayer,
  SingleLineLayer,
  WebGLRenderer,
} from "@";

// const singleMeshLayer = new SingleMeshLayer();
const singleLineLayer = new SingleLineLayer();
const layersManager = new LayerManager();
// layersManager.add(singleMeshLayer);
layersManager.add(singleLineLayer);

const renderer = new WebGLRenderer("#canvas");
const camera = new PerspectiveCamera(60, renderer.width / renderer.height);

function animate() {
  renderer.render(layersManager, camera);
  requestAnimationFrame(animate);
}

animate();
