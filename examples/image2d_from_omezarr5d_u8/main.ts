import {
  LayerManager,
  ImageLayer,
  WebGLRenderer,
  OmeZarrImageSource,
  OrthographicCamera,
} from "@";

const url =
  "https://public.czbiohub.org/royerlab/ultrack/multi-color/image.zarr/";
const layerManager = new LayerManager();
const renderer = new WebGLRenderer("#canvas");
const camera = new OrthographicCamera(
  -renderer.width / 2,
  renderer.width / 2,
  -renderer.height / 2,
  renderer.height / 2
);

// Source is technically 5D (even though Z is unitary),
// so provide indices at 3 dimensions to project to 2D.
const source = new OmeZarrImageSource(url);
const region = [
  { dimension: "T", index: 150 },
  { dimension: "C", index: 0 },
  { dimension: "Z", index: 0 },
];
const layer = new ImageLayer(source, region);
layerManager.add(layer);

function animate() {
  renderer.render(layerManager, camera);
  requestAnimationFrame(animate);
}

animate();
