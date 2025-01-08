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

const plateUrl = "http://127.0.0.1:8081/2024_11_07_A549_SEC61_ZIKV_DENV.zarr";
const plate = await loadOmeZarrPlate(plateUrl);
console.debug("plate", plate);

const wellPaths = plate.plate.wells.map((well) => well.path);
const wellSelector = document.querySelector("#well") as HTMLSelectElement;
wellPaths.forEach((path) => {
  const option = document.createElement("option");
  option.value = path;
  option.text = path;
  wellSelector.appendChild(option);
});

const layerManager = new LayerManager();
const renderer = new WebGLRenderer("#canvas");
const camera = new OrthographicCamera(0, 5120, 0, 2160);
const controls = new PanZoomControls(camera, camera.position);
renderer.setControls(controls);
const region = [
  { dimension: "T", index: 0 },
  { dimension: "C", index: 0 },
  { dimension: "Z", index: 0 },
];

const imageSelector = document.querySelector("#image") as HTMLSelectElement;

const onImageChange = async () => {
  console.debug("onImageChange: ", imageSelector.value);
  layerManager.layers.length = 0;
  const imageUrl =
    plateUrl + "/" + wellSelector.value + "/" + imageSelector.value;
  const source = new OmeZarrImageSource(imageUrl);
  const layer = new ImageLayer(source, region);
  layerManager.add(layer);
};

const onWellChange = async () => {
  console.debug("onWellChange: ", wellSelector.value);
  layerManager.layers.length = 0;
  const path = wellSelector.value;
  const well = await loadOmeZarrWell(plateUrl, path);
  console.debug("well", well);
  const imagePaths = well.well.images.map((image) => image.path);
  imageSelector.innerHTML = "";
  imagePaths.forEach((path) => {
    const option = document.createElement("option");
    option.value = path;
    option.text = path;
    imageSelector.appendChild(option);
  });
  await onImageChange();
};

wellSelector.addEventListener("change", onWellChange);
imageSelector.addEventListener("change", onImageChange);
await onWellChange();

function animate() {
  renderer.render(layerManager, camera);
  requestAnimationFrame(animate);
}

animate();
