import "./modulepreload-polyfill-DaKOjhqt.js";
import { j as Camera, k as fromValues, p as perspective, m as toRadian, L as Layer, I as Idetik } from "./metadata_loaders-CXLkXwNR.js";
import { P as ProjectedLineGeometry, a as ProjectedLine } from "./projected_line-CtC2xUEg.js";
const DEFAULT_FOV = 60;
const DEFAULT_ASPECT_RATIO = 1.77;
const MIN_FOV = 0.1;
const MAX_FOV = 180 - MIN_FOV;
class PerspectiveCamera extends Camera {
  fov_;
  aspectRatio_;
  constructor(options = {}) {
    const {
      fov = DEFAULT_FOV,
      aspectRatio = DEFAULT_ASPECT_RATIO,
      near = 0.1,
      far = 1e4,
      position = fromValues(0, 0, 0)
    } = options;
    if (fov < MIN_FOV || fov > MAX_FOV) {
      throw new Error(
        `Invalid field of view: ${fov}, must be in [${MIN_FOV}, ${MAX_FOV}] degrees`
      );
    }
    super();
    this.fov_ = fov;
    this.aspectRatio_ = aspectRatio;
    this.near_ = near;
    this.far_ = far;
    this.transform.setTranslation(position);
    this.updateProjectionMatrix();
  }
  setAspectRatio(aspectRatio) {
    this.aspectRatio_ = aspectRatio;
    this.updateProjectionMatrix();
  }
  get type() {
    return "PerspectiveCamera";
  }
  get fov() {
    return this.fov_;
  }
  zoom(factor) {
    if (factor <= 0) {
      throw new Error(`Invalid zoom factor: ${factor}`);
    }
    this.fov_ = Math.max(MIN_FOV, Math.min(MAX_FOV, this.fov_ / factor));
    this.updateProjectionMatrix();
  }
  updateProjectionMatrix() {
    perspective(
      this.projectionMatrix_,
      toRadian(this.fov),
      this.aspectRatio_,
      this.near_,
      this.far_
    );
  }
}
class ProjectedLineLayer extends Layer {
  type = "ProjectedLineLayer";
  paths_ = [];
  constructor(lines = []) {
    super();
    lines.forEach((line) => this.addLine(line));
    this.setState("ready");
  }
  addLine(line) {
    const { path, color, width } = line;
    this.paths_.push(path);
    const geometry = new ProjectedLineGeometry(path);
    this.addObject(new ProjectedLine({ geometry, color, width }));
  }
  update() {
  }
  // TODO: this is temporary - we may want to generalize this to all layers
  // for now it is used to set the initial camera position to be centered on the tracks
  get extent() {
    return getPathBoundingBox(this.paths_.flat());
  }
}
function getPathBoundingBox(path) {
  function getAxisBounds(index) {
    const values = path.map((point) => point[index]);
    return [Math.min(...values), Math.max(...values)];
  }
  const [xMin, xMax] = getAxisBounds(0);
  const [yMin, yMax] = getAxisBounds(1);
  const [zMin, zMax] = getAxisBounds(2);
  return { xMin, xMax, yMin, yMax, zMin, zMax };
}
const helixA = generateHelix({
  radius: 1,
  turns: 3,
  pointsPerTurn: 100,
  pitch: 1.5,
  phase: 0
});
const helixB = generateHelix({
  radius: 1,
  turns: 3,
  pointsPerTurn: 100,
  pitch: 1.5,
  phase: 90
});
const layer = new ProjectedLineLayer([
  { path: helixA, color: [1, 0.7, 0], width: 0.01 },
  { path: helixB, color: [0, 0.7, 0], width: 0.02 }
]);
new Idetik({
  canvas: document.querySelector("canvas"),
  camera: new PerspectiveCamera({ fov: 60 }),
  layers: [layer]
}).start();
function generateHelix(params) {
  const { radius, turns, pointsPerTurn, pitch, phase } = params;
  const phaseRad = phase * Math.PI / 180;
  const path = [];
  const totalPoints = turns * pointsPerTurn;
  for (let i = 0; i < totalPoints; i++) {
    const angle = i / pointsPerTurn * 2 * Math.PI;
    const z = radius * Math.cos(angle + phaseRad) - 5;
    const y = i / pointsPerTurn * pitch - pitch * turns / 2;
    const x = radius * Math.sin(angle + phaseRad);
    path.push([x, y, z]);
  }
  return path;
}
//# sourceMappingURL=projected_lines-CwiCV4ME.js.map
