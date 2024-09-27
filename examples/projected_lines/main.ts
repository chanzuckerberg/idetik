import { LayerManager, PerspectiveCamera, ProjectedLineLayer, WebGLRenderer } from "@";

const layersManager = new LayerManager();
const layer = new ProjectedLineLayer();
layersManager.add(layer);

const helixA = generateHelix({
  radius: 1.0,
  turns: 3.0,
  pointsPerTurn: 100,
  pitch: 1.5,
  phase: 0.0,
});
layer.addLine({ path: helixA, color: [1.0, 0.7, 0.0], width: 0.1 });

const helixB = generateHelix({
  radius: 1.0,
  turns: 3.0,
  pointsPerTurn: 100,
  pitch: 1.5,
  phase: 90.0,
});
layer.addLine({ path: helixB, color: [0.0, 0.7, 0.0], width: 0.2 });

const renderer = new WebGLRenderer("#canvas");
const camera = new PerspectiveCamera(60, renderer.width / renderer.height);

animate();

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
