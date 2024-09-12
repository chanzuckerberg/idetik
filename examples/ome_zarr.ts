import {
  LayerManager,
  PerspectiveCamera,
  ImageLayer,
  WebGLRenderer,
  OmeZarrMultiscaleImageSource,
} from "@";

const url =
  "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/";
const layerManager = new LayerManager();
const renderer = new WebGLRenderer("#canvas");
const camera = new PerspectiveCamera(60, renderer.width / renderer.height);

// Source is 5D, so provide indices at 3 dimensions to project to 2D.
const region = [
  { dimension: "t", index: 0 },
  { dimension: "c", index: 0 },
  { dimension: "z", index: 277.76 },
];
OmeZarrMultiscaleImageSource.open(url).then((source) => {
  const layer = new ImageLayer(source, region);
  layerManager.add(layer);
});

function animate() {
  renderer.render(layerManager, camera);
  requestAnimationFrame(animate);
}

animate();
