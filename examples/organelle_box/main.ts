import {
  LayerManager,
  ImageLayer,
  OrthographicCamera,
  WebGLRenderer,
  OmeZarrImageSource,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";
import {
  loadOmeZarrPlate,
  loadOmeZarrWell,
} from "@/data/ome_zarr_hcs_metadata_loader";

// From https://zenodo.org/records/11262587
const plateUrl =
  "http://127.0.0.1:8081/20200812-CardiomyocyteDifferentiation14-Cycle1_mip.zarr";
const plate = await loadOmeZarrPlate(plateUrl);
console.debug("plate", plate);
const wellPath = plate.plate.wells[0].path;
const well = await loadOmeZarrWell(plateUrl, wellPath);
console.debug("well", well);
const imagePath = well.well.images[0].path;
const imageUrl = plateUrl + "/" + wellPath + "/" + imagePath;

const layerManager = new LayerManager();
const renderer = new WebGLRenderer("#canvas");
const camera = new OrthographicCamera(0, 1920, 0, 1440);
const controls = new PanZoomControls(camera, camera.position);
renderer.setControls(controls);
const source = new OmeZarrImageSource(imageUrl);
const region = [
  { dimension: "c", index: 0 },
  { dimension: "z", index: 0 },
];
const layer = new ImageLayer(source, region);
layerManager.add(layer);

function animate() {
  renderer.render(layerManager, camera);
  requestAnimationFrame(animate);
}

animate();
