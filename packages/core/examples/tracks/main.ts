import { vec3 } from "gl-matrix";
import {
  ImageSeriesLayer,
  LayerManager,
  OrthographicCamera,
  OmeZarrImageSource,
  TracksLayer,
  WebGLRenderer,
  Region,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";

// payload roughly equivalent to task 0 from
// https://public.czbiohub.org/royerlab/ultrack/multi-color/mock_data.json
const trackAPath: vec3[] = [
  [1822.0, 1350.0, 0.0],
  [1825.0, 1350.0, 0.0],
  [1831.0, 1351.0, 0.0],
  [1826.0, 1350.0, 0.0],
  [1827.0, 1350.0, 0.0],
  [1827.0, 1351.0, 0.0],
];
const trackATime = [28, 29, 30, 31, 32, 33];
const trackBPath: vec3[] = [
  [1818.0, 1347.0, 0.0],
  [1820.0, 1343.0, 0.0],
  [1820.0, 1341.0, 0.0],
  [1824.0, 1345.0, 0.0],
  [1824.0, 1350.0, 0.0],
];
const trackBTime = [34, 35, 36, 37, 38];
const trackCPath: vec3[] = [
  [1841.0, 1353.0, 0.0],
  [1842.0, 1356.0, 0.0],
  [1842.0, 1356.0, 0.0],
  [1840.0, 1367.0, 0.0],
  [1844.0, 1378.0, 0.0],
];
const trackCTime = [34, 35, 36, 37, 38];
const interpolation = { pointsPerSegment: 10, tangentFactor: 0.3 };

const lineLayer = new TracksLayer([
  {
    path: trackAPath,
    time: trackATime,
    color: [1.0, 0.0, 0.0],
    width: 0.02,
    interpolation,
  },
  {
    path: trackBPath,
    time: trackBTime,
    color: [0.0, 1.0, 0.0],
    width: 0.02,
    interpolation,
  },
  {
    path: trackCPath,
    time: trackCTime,
    color: [0.0, 1.0, 1.0],
    width: 0.02,
    interpolation,
  },
]);

const url =
  "https://public.czbiohub.org/royerlab/ultrack/multi-color/image.zarr/";
const source = new OmeZarrImageSource(url);
const timeInterval = { start: 28, stop: 39 };
const region: Region = [
  { dimension: "T", index: { type: "interval", ...timeInterval } },
  { dimension: "C", index: { type: "full" } },
  { dimension: "Z", index: { type: "point", value: 0 } },
  { dimension: "Y", index: { type: "full" } },
  { dimension: "X", index: { type: "full" } },
];
// Raise the contrast limits for the blue channel because there is
// a lot of low signal that washes everything else out.
const channelProps = [
  {
    color: [1, 0, 0] as [number, number, number],
    contrastLimits: [0, 255] as [number, number],
  },
  {
    color: [0, 1, 0] as [number, number, number],
    contrastLimits: [0, 255] as [number, number],
  },
  {
    color: [0, 0, 1] as [number, number, number],
    contrastLimits: [128, 255] as [number, number],
  },
];
const imageSeriesLayer = new ImageSeriesLayer({
  source,
  region,
  seriesDimensionName: "T",
  channelProps,
});

const renderer = new WebGLRenderer("#canvas");

const layerManager = new LayerManager();
layerManager.add(imageSeriesLayer);
layerManager.add(lineLayer);

const { xMin: left, xMax: right, yMin: top, yMax: bottom } = lineLayer.extent;
const camera = new OrthographicCamera(left, right, top, bottom);
camera.zoom = 0.5;
camera.transform.translate([0, 0, 1]);

const controls = new PanZoomControls(camera, camera.position);
renderer.setControls(controls);

const slider = document.querySelector<HTMLInputElement>("#slider");
if (slider === null) throw new Error("Time slider not found.");
slider.min = timeInterval.start.toString();
slider.max = (timeInterval.stop - 1).toString();
slider.value = slider.min;

imageSeriesLayer.preloadSeries({initialIndex: slider.valueAsNumber - timeInterval.start});
lineLayer.setTimeIndex(slider.valueAsNumber);

slider.addEventListener("input", (event) => {
  const value = (event.target as HTMLInputElement).valueAsNumber;
  imageSeriesLayer.setPosition(value);
  lineLayer.setTimeIndex(value);
});

animate();

function animate() {
  renderer.render(layerManager, camera);
  requestAnimationFrame(animate);
}
