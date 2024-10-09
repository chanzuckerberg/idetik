import { quat } from "gl-matrix";
import {
  LayerManager,
  PerspectiveCamera,
  ProjectedLineLayer,
  WebGLRenderer,
} from "@";

const layersManager = new LayerManager();

const helixA = generateHelix({
  radius: 1.0,
  turns: 3.0,
  pointsPerTurn: 100,
  pitch: 1.5,
  phase: 0.0,
});

const helixB = generateHelix({
  radius: 1.0,
  turns: 3.0,
  pointsPerTurn: 100,
  pitch: 1.5,
  phase: 90.0,
});

const stationaryLayer = new ProjectedLineLayer([
  { path: helixA, color: [1.0, 0.7, 0.0], width: 0.1 },
]);
const transformedLayer = new ProjectedLineLayer([
  { path: helixB, color: [0.0, 0.7, 0.0], width: 0.2 },
]);
layersManager.add(stationaryLayer);
layersManager.add(transformedLayer);

const renderer = new WebGLRenderer("#canvas");
const camera = new PerspectiveCamera(60, renderer.width / renderer.height);

animate();

const rotate = () => {
  transformedLayer.transform.rotate(
    quat.fromEuler(quat.create(), 0.0, 0.0, 0.2)
  );
};
setInterval(rotate, 5);

function animate() {
  renderer.render(layersManager, camera);
  requestAnimationFrame(animate);
}

function generateHelix(params: {
  radius: number;
  turns: number;
  pointsPerTurn: number;
  pitch: number;
  phase: number;
}) {
  const { radius, turns, pointsPerTurn, pitch, phase } = params;
  const phaseRad = (phase * Math.PI) / 180;
  const path: [number, number, number][] = [];
  const totalPoints = turns * pointsPerTurn;

  for (let i = 0; i < totalPoints; i++) {
    const angle = (i / pointsPerTurn) * 2 * Math.PI;
    const z = radius * Math.cos(angle + phaseRad) - 5.0;
    const y = (i / pointsPerTurn) * pitch - (pitch * turns) / 2;
    const x = radius * Math.sin(angle + phaseRad);
    path.push([x, y, z]);
  }
  return path;
}
