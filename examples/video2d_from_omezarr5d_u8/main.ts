import {
  LayerManager,
  PerspectiveCamera,
  VideoLayer,
  WebGLRenderer,
  OmeZarrImageSource,
} from "@";

const url =
  "https://public.czbiohub.org/royerlab/ultrack/multi-color/image.zarr/";
const layerManager = new LayerManager();
const renderer = new WebGLRenderer("#canvas");
const camera = new PerspectiveCamera(60, renderer.width / renderer.height);

// Source is technically 5D (even though Z is unitary),
// so provide indices at 3 dimensions to project to 2D.
const source = new OmeZarrImageSource(url);
const timeInterval = { start: 100, stop: 150 };
const region = [
  { dimension: "T", index: timeInterval },
  { dimension: "C", index: 0 },
  { dimension: "Z", index: 0 },
];
const layer = new VideoLayer(source, region, "T");
layerManager.add(layer);

const slider = document.querySelector<HTMLInputElement>("#slider");
if (slider === null) throw new Error("Time slider not found.");
slider.min = timeInterval.start.toString();
slider.max = (timeInterval.stop - 1).toString();
slider.addEventListener("input", (event) => {
  if (!(event.target instanceof HTMLInputElement)) return;
  const value = event.target.valueAsNumber;
  console.log("slider changed: ", value);
  layer.setTimeIndex(value);
});

function animate() {
  renderer.render(layerManager, camera);
  requestAnimationFrame(animate);
}

animate();
