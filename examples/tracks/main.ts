import { vec3 } from "gl-matrix";
import {
  ImageSeriesLayer,
  LayerManager,
  LayerState,
  OrthographicCamera,
  OmeZarrImageSource,
  ProjectedLineLayer,
  WebGLRenderer,
} from "@";

// payload roughly equivalent to task 0 from
// https://public.czbiohub.org/royerlab/ultrack/multi-color/mock_data.json
// TODO: we don't want to transform the coordinates manually like this
// https://github.com/chanzuckerberg/imaging-active-learning/issues/88
const trackAPath: vec3[] = [
  [1822.0, 1440 - 1350.0, 0.0],
  [1825.0, 1440 - 1350.0, 0.0],
  [1831.0, 1440 - 1351.0, 0.0],
  [1826.0, 1440 - 1350.0, 0.0],
  [1827.0, 1440 - 1350.0, 0.0],
  [1827.0, 1440 - 1351.0, 0.0],
];
const trackBPath: vec3[] = [
  [1818.0, 1440 - 1347.0, 0.0],
  [1820.0, 1440 - 1343.0, 0.0],
  [1820.0, 1440 - 1341.0, 0.0],
  [1824.0, 1440 - 1345.0, 0.0],
  [1824.0, 1440 - 1350.0, 0.0],
];
const trackCPath: vec3[] = [
  [1841.0, 1440 - 1353.0, 0.0],
  [1842.0, 1440 - 1356.0, 0.0],
  [1842.0, 1440 - 1356.0, 0.0],
  [1840.0, 1440 - 1367.0, 0.0],
  [1844.0, 1440 - 1378.0, 0.0],
];
const lineLayer = new ProjectedLineLayer([
  { path: trackAPath, color: [1.0, 0.0, 0.0], width: 0.01 },
  { path: trackBPath, color: [0.0, 1.0, 0.0], width: 0.01 },
  { path: trackCPath, color: [0.0, 0.0, 1.0], width: 0.01 },
]);

const url =
  "https://public.czbiohub.org/royerlab/ultrack/multi-color/image.zarr/";
const source = new OmeZarrImageSource(url);
const timeInterval = { start: 28, stop: 39 };
const region = [
  { dimension: "T", index: timeInterval },
  { dimension: "C", index: { start: 0, stop: 3 } },
  { dimension: "Z", index: 0 },
];

const imageSeriesLayer = new ImageSeriesLayer(source, region, "T");

const renderer = new WebGLRenderer("#canvas");

const layerManager = new LayerManager();
layerManager.add(lineLayer);
layerManager.add(imageSeriesLayer);

const { xMin: left, xMax: right, yMin: bottom, yMax: top } = lineLayer.extent;
// TODO: instead of padding, we should add zoom to the camera
const padding = 0.25 * Math.max(right - left, top - bottom);
const camera = new OrthographicCamera(
  left - padding,
  right + padding,
  bottom - padding,
  top + padding,
  0.0,
  100
);

const slider = document.querySelector<HTMLInputElement>("#slider");
if (slider === null) throw new Error("Time slider not found.");
slider.min = timeInterval.start.toString();
slider.max = (timeInterval.stop - 1).toString();

imageSeriesLayer.pushStateChangeCallback((newState: LayerState) => {
  if (newState === "ready") {
    slider.addEventListener("input", (event) => {
      const value = (event.target as HTMLInputElement).valueAsNumber;
      imageSeriesLayer.setTimeIndex(value);
    });
    imageSeriesLayer.setTimeIndex(slider.valueAsNumber);
  }
});

animate();

function animate() {
  renderer.render(layerManager, camera);
  requestAnimationFrame(animate);
}
