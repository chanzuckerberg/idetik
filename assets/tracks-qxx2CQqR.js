import "./modulepreload-polyfill-DaKOjhqt.js";
import { L as Layer, n as clone, s as scaleAndAdd, d as create, o as bezier, q as copy, r as sub, u as add, v as scale, I as Idetik } from "./metadata_loaders-CXLkXwNR.js";
import { O as OmeZarrImageSource, a as OrthographicCamera } from "./image_source-BemCU8_Z.js";
import { P as PanZoomControls } from "./controls-C_nkNJ-y.js";
import { P as ProjectedLineGeometry, a as ProjectedLine } from "./projected_line-CtC2xUEg.js";
import { I as ImageSeriesLayer } from "./image_series_layer-xl760NUg.js";
class TracksLayer extends Layer {
  type = "TracksLayer";
  tracks_ = [];
  constructor(tracks = []) {
    super();
    tracks.forEach((track) => this.addLine(track));
    this.setState("ready");
  }
  addLine(track) {
    this.tracks_.push(track);
    let geometry;
    if (track.interpolation) {
      const interpolatedPath = cubicBezierInterpolation({
        path: track.path,
        pointsPerSegment: track.interpolation.pointsPerSegment,
        tangentFactor: track.interpolation.tangentFactor
      });
      geometry = new ProjectedLineGeometry(interpolatedPath);
    } else {
      geometry = new ProjectedLineGeometry(track.path);
    }
    const { color, width } = track;
    const taperOffset = 0.5;
    const taperPower = 1.5;
    this.addObject(
      new ProjectedLine({ geometry, color, width, taperOffset, taperPower })
    );
  }
  setTimeIndex(index) {
    for (const [i, track] of this.tracks_.entries()) {
      if (!track.time) {
        continue;
      }
      let offset = 0.5;
      if (index < track.time[0]) {
        offset = -1.5;
      } else if (index > track.time[track.time.length - 1]) {
        offset = 1.5;
      }
      const timeIndex = track.time.findIndex((time) => time === index);
      if (track.time && timeIndex !== -1) {
        offset = timeIndex / (track.time.length - 1);
      }
      const object = this.objects[i];
      object.taperOffset = offset;
    }
  }
  update() {
  }
  // TODO: this is temporary - we may want to generalize this to all layers
  // for now it is used to set the initial camera position to be centered on the tracks
  get extent() {
    const paths = this.tracks_.map((track) => track.path);
    return getPathBoundingBox(paths.flat());
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
function cubicBezierInterpolation({
  path,
  pointsPerSegment,
  tangentFactor = 1 / 3
}) {
  const tangents = pathTangents(path);
  const out = Array((path.length - 1) * pointsPerSegment);
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const d = path[i + 1];
    const b = clone(tangents[i]);
    scaleAndAdd(b, a, b, tangentFactor);
    const c = clone(tangents[i + 1]);
    scaleAndAdd(c, d, c, -tangentFactor);
    for (let p = 0; p < pointsPerSegment; p++) {
      const t = p / pointsPerSegment;
      const o = out[i * pointsPerSegment + p] = create();
      bezier(o, a, b, c, d, t);
    }
  }
  return out;
}
function pathTangents(path) {
  if (path.length < 2) {
    throw new Error("Path must contain at least 2 points");
  }
  const tangents = Array(path.length);
  const m0 = create();
  const m1 = create();
  for (let i = 0; i < path.length; i++) {
    const curr = path[i];
    const next = path[i + 1] ?? path[i];
    tangents[i] = create();
    if (i !== 0) {
      copy(m0, m1);
    }
    if (i !== path.length - 1) {
      sub(m1, next, curr);
    }
    if (i === 0) {
      copy(tangents[i], m1);
    } else if (i == path.length - 1) {
      copy(tangents[i], m0);
    } else {
      add(tangents[i], m0, m1);
      scale(tangents[i], tangents[i], 0.5);
    }
  }
  return tangents;
}
const trackAPath = [
  [1822, 1350, 0],
  [1825, 1350, 0],
  [1831, 1351, 0],
  [1826, 1350, 0],
  [1827, 1350, 0],
  [1827, 1351, 0]
];
const trackATime = [28, 29, 30, 31, 32, 33];
const trackBPath = [
  [1818, 1347, 0],
  [1820, 1343, 0],
  [1820, 1341, 0],
  [1824, 1345, 0],
  [1824, 1350, 0]
];
const trackBTime = [34, 35, 36, 37, 38];
const trackCPath = [
  [1841, 1353, 0],
  [1842, 1356, 0],
  [1842, 1356, 0],
  [1840, 1367, 0],
  [1844, 1378, 0]
];
const trackCTime = [34, 35, 36, 37, 38];
const interpolation = { pointsPerSegment: 10, tangentFactor: 0.3 };
const lineLayer = new TracksLayer([
  {
    path: trackAPath,
    time: trackATime,
    color: [1, 0, 0],
    width: 0.02,
    interpolation
  },
  {
    path: trackBPath,
    time: trackBTime,
    color: [0, 1, 0],
    width: 0.02,
    interpolation
  },
  {
    path: trackCPath,
    time: trackCTime,
    color: [0, 1, 1],
    width: 0.02,
    interpolation
  }
]);
const url = "https://public.czbiohub.org/royerlab/ultrack/multi-color/image.zarr/";
const source = new OmeZarrImageSource(url);
const timeInterval = { start: 28, stop: 39 };
const region = [
  { dimension: "T", index: { type: "interval", ...timeInterval } },
  { dimension: "C", index: { type: "full" } },
  { dimension: "Z", index: { type: "point", value: 0 } },
  { dimension: "Y", index: { type: "full" } },
  { dimension: "X", index: { type: "full" } }
];
const channelProps = [
  {
    color: [1, 0, 0],
    contrastLimits: [0, 255]
  },
  {
    color: [0, 1, 0],
    contrastLimits: [0, 255]
  },
  {
    color: [0, 0, 1],
    contrastLimits: [128, 255]
  }
];
const imageSeriesLayer = new ImageSeriesLayer({
  source,
  region,
  seriesDimensionName: "T",
  channelProps
});
const slider = document.querySelector("#slider");
if (slider === null) throw new Error("Time slider not found.");
slider.min = timeInterval.start.toString();
slider.max = (timeInterval.stop - 1).toString();
slider.value = slider.min;
imageSeriesLayer.setIndex(slider.valueAsNumber - timeInterval.start);
lineLayer.setTimeIndex(slider.valueAsNumber);
imageSeriesLayer.preloadSeries();
slider.addEventListener("input", (event) => {
  const value = event.target.valueAsNumber;
  imageSeriesLayer.setPosition(value);
  lineLayer.setTimeIndex(value);
});
const { xMin: left, xMax: right, yMin: top, yMax: bottom } = lineLayer.extent;
const camera = new OrthographicCamera(left, right, top, bottom);
camera.zoom(0.5);
new Idetik({
  canvas: document.querySelector("canvas"),
  camera,
  cameraControls: new PanZoomControls(camera),
  layers: [imageSeriesLayer, lineLayer]
}).start();
//# sourceMappingURL=tracks-qxx2CQqR.js.map
