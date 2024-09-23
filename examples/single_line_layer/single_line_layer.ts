import {
  LayerManager,
  PerspectiveCamera,
  SingleLineLayer,
  WebGLRenderer,
} from "@";

const path: [number, number, number][] = [];
const radius = 1.0;
const turns = 3;
const pointsPerTurn = 100;
const totalPoints = turns * pointsPerTurn;
const heightIncrement = 1.5;

for (let i = 0; i < totalPoints; i++) {
  const angle = (i / pointsPerTurn) * 2 * Math.PI;
  const z = radius * Math.cos(angle) - 5.0;
  const y =
    (i / pointsPerTurn) * heightIncrement - (heightIncrement * turns) / 2;
  const x = radius * Math.sin(angle);
  path.push([x, y, z]);
}
const helix = new SingleLineLayer(path);

path.length = 0;
path.push([0.0, -2.5, -5.0], [0.0, 2.5, -5.0]);
const line = new SingleLineLayer(path, [0.0, 0.7, 0.0], 0.5);

const layersManager = new LayerManager();
layersManager.add(helix);
layersManager.add(line);

const renderer = new WebGLRenderer("#canvas");
const camera = new PerspectiveCamera(60, renderer.width / renderer.height);

function animate() {
  renderer.render(layersManager, camera);
  requestAnimationFrame(animate);
}

animate();
