import {
  LayerManager,
  ImageLayer,
  WebGLRenderer,
  OmeZarrImageSource,
  OrthographicCamera,
} from "@";

const url =
  "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/";
const layerManager = new LayerManager();
const renderer = new WebGLRenderer("#canvas");
// This matches the sub-region index in x/y, but is presented
// incorrectly because of the plane geometry and scaling of
// those dimensions.
const camera = new OrthographicCamera(150, 950, 100, 900);

// Source is 5D, so provide indices at 3 dimensions to project to 2D.
// Also specify a subregion in x and y to exercise that part of the API.
const source = new OmeZarrImageSource(url);
const region = [
  { dimension: "t", index: 400 },
  { dimension: "c", index: 0 },
  { dimension: "z", index: 300 },
  { dimension: "y", index: { start: 100, stop: 900 } },
  { dimension: "x", index: { start: 150, stop: 950 } },
];
const layer = new ImageLayer(source, region);
layerManager.add(layer);

function animate() {
  renderer.render(layerManager, camera);
  requestAnimationFrame(animate);
}

animate();
