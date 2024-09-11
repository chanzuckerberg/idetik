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

OmeZarrMultiscaleVolumeSource.open(url).then((source) => {
  const layer = new OmeZarr2DSliceLayer(source);
  layersManager.add(layer);
});

function animate() {
  renderer.render(layersManager, camera);
  requestAnimationFrame(animate);
}

animate();
