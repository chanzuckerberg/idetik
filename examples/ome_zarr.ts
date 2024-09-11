import {
  LayerManager,
  PerspectiveCamera,
  OmeZarr2DSliceLayer,
  WebGLRenderer,
  OmeZarrMultiscaleVolumeSource,
} from "@";

const url =
  "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/";
const layersManager = new LayerManager();
const renderer = new WebGLRenderer("#canvas");
const camera = new PerspectiveCamera(60, renderer.width / renderer.height);

// Source is 5D, so provide indices at 3 dimensions to project to 2D.
const region = [
  { dimension: "t", start: 0 },
  { dimension: "c", start: 0 },
  { dimension: "z", start: 277.76 },
];
OmeZarrMultiscaleVolumeSource.open(url).then((source) => {
  const layer = new OmeZarr2DSliceLayer(source, region);
  layersManager.add(layer);
});

function animate() {
  renderer.render(layersManager, camera);
  requestAnimationFrame(animate);
}

animate();
