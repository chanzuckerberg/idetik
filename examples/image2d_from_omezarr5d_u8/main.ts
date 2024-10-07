import {
  LayerManager,
  PerspectiveCamera,
  ImageLayer,
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
const region = [
  { dimension: "T", index: 150 },
  { dimension: "C", index: 0 },
  { dimension: "Z", index: 0 },
];
const contrastLimits = {
  low: 0,
  high: 255,
};
const layer = new ImageLayer(source, region, contrastLimits);
layerManager.add(layer);

function animate() {
  renderer.render(layerManager, camera);
  requestAnimationFrame(animate);
}

animate();
