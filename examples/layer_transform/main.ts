import { quat } from "gl-matrix";
import {
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
stationaryLayer.transform.translate([0.0, 0.0, 5]);
stationaryLayer.transform.rotate(
  quat.fromEuler(quat.create(), 45.0, -45.0, 0.0)
);
stationaryLayer.transform.translate([0.0, 0.0, -5]);
layersManager.add(stationaryLayer);
layersManager.add(movingLayer);

const renderer = new WebGLRenderer("#canvas");
const camera = new PerspectiveCamera(60, renderer.width / renderer.height);

animate();

const rotate = () => {
  movingLayer.transform.translate([0.0, 0.0, 5]);
  movingLayer.transform.rotate(quat.fromEuler(quat.create(), 0.1, 0.2, 0.5));
  movingLayer.transform.translate([0.0, 0.0, -5]);
};
setInterval(rotate, 5);

function animate() {
  renderer.render(layersManager, camera);
  requestAnimationFrame(animate);
}
