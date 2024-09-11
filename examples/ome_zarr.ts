import {
  LayerManager,
  PerspectiveCamera,
  OmeZarr2DSliceLayer,
  WebGLRenderer,
  OmeZarrMultiscaleVolumeSource,
} from "@";

const url = "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/";
const layersManager = new LayerManager();
const renderer = new WebGLRenderer("#canvas");
const camera = new PerspectiveCamera(60, renderer.width / renderer.height);

// Only add an instance of the layer when we have opened the OME-Zarr
// and have access to all of its metadata.
OmeZarrMultiscaleVolumeSource.open(url).then((source) => {
  // After opening the image source, we should have all the info we
  // need to define the basic geometry of the layers objects (i.e.
  // we know how many chunks there are, the overall extent).
  // But the texture data still needs to be updated.
  const layer = new OmeZarr2DSliceLayer(source);
  layersManager.add(layer);
});

function animate() {
  renderer.render(layersManager, camera);
  requestAnimationFrame(animate);
}

animate();
