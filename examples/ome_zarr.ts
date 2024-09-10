import {
  LayerManager,
  PerspectiveCamera,
  ImageLayer,
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
  // But the texture might be updated.
  const layer = new ImageLayer(source);
  layersManager.add(layer);
  // TODO: This example only needs a single load, but we need to think about
  // when load should be called (e.g. any time the FOV or canvas size changes).
  renderer.load(layersManager);
});

function animate() {
  renderer.render(layersManager, camera);
  requestAnimationFrame(animate);
}

animate();
