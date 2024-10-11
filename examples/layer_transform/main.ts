import { quat } from "gl-matrix";
import {
  Layer,
  LayerManager,
  PerspectiveCamera,
  ProjectedLineLayer,
  WebGLRenderer,
} from "@";

const layersManager = new LayerManager();

const movingLayer = new ProjectedLineLayer([
  {
    path: [
      [-1, 0, -5],
      [0, -1, -5],
      [1, 0, -5],
      [0, 1, -5],
      [-1, 0, -5],
    ],
    color: [0.7, 0.7, 0.0],
    width: 0.1,
  },
]);
const stationaryLayer = new ProjectedLineLayer([
  {
    path: [
      [-1, 0, -5],
      [1, 0, -5],
    ],
    color: [0.7, 0.0, 0.0],
    width: 0.1,
  },
  {
    path: [
      [0, -1, -5],
      [0, 1, -5],
    ],
    color: [0.0, 0.7, 0.0],
    width: 0.1,
  },
  {
    path: [
      [0, 0, -6],
      [0, 0, -4],
    ],
    color: [0.0, 0.0, 0.7],
    width: 0.1,
  },
]);
layersManager.add(stationaryLayer);
layersManager.add(movingLayer);

const renderer = new WebGLRenderer("#canvas");
const camera = new PerspectiveCamera(60, renderer.width / renderer.height);

animate();

const rotateAboutCenter = (layer: Layer, x: number, y: number, z: number) => {
  layer.transform.translate([0.0, 0.0, 5]);
  layer.transform.rotate(quat.fromEuler(quat.create(), x, y, z));
  layer.transform.translate([0.0, 0.0, -5]);
};

rotateAboutCenter(stationaryLayer, 45.0, -45.0, 0.0);
setInterval(rotateAboutCenter, 5, movingLayer, 0.1, 0.2, 0.5);

function animate() {
  renderer.render(layersManager, camera);
  requestAnimationFrame(animate);
}
