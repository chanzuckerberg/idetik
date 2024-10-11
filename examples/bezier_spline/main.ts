import {
  LayerManager,
  PerspectiveCamera,
  ProjectedLineLayer,
  WebGLRenderer,
} from "@";
import { cubicBezierInterpolation } from "@/core/splines";

const layersManager = new LayerManager();
const layer = new ProjectedLineLayer();
layersManager.add(layer);

const starPath: [number, number, number][] = [
  [-1.0, -1.0, -5.0],
  [0.0, 1.0, -5.0],
  [1.0, -1.0, -5.0],
  [-1.0, 0.2, -5.0],
  [1.0, 0.2, -5.0],
  [-0.8, -0.9, -5.0],
];
layer.addLine({ path: starPath, color: [1.0, 0.0, 0.0], width: 0.05 });

for (const f of [0.0, 0.1, 0.3, 0.5, 0.7, 1.0]) {
  const interpolatedPath = cubicBezierInterpolation({
    path: starPath,
    pointsPerSegment: 100,
    tangentFactor: f,
  });
  layer.addLine({
    path: interpolatedPath as [number, number, number][],
    color: [f, 1.0 - f, 1.0],
    width: 0.1,
  });
}

const renderer = new WebGLRenderer("#canvas");
const camera = new PerspectiveCamera(60, renderer.width / renderer.height);

animate();

function animate() {
  renderer.render(layersManager, camera);
  requestAnimationFrame(animate);
}
