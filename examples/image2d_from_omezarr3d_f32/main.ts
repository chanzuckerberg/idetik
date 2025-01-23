import {
  LayerManager,
  ImageLayer,
  OrthographicCamera,
  WebGLRenderer,
  OmeZarrImageSource,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";

const sliderMin = document.getElementById("slider-min") as HTMLInputElement;
const sliderMax = document.getElementById("slider-max") as HTMLInputElement;

const url =
  "https://files.cryoetdataportal.cziscience.com/10444/24apr23a_Position_12/Reconstructions/VoxelSpacing4.990/Tomograms/100/24apr23a_Position_12.zarr";
const pixelScale = 4.99;
const layerManager = new LayerManager();
const renderer = new WebGLRenderer("#canvas");
const camera = new OrthographicCamera(
  0,
  pixelScale * 1264,
  0,
  pixelScale * 1264
);
const controls = new PanZoomControls(camera, camera.position);
renderer.setControls(controls);
const region = [{ dimension: "z", index: pixelScale * 120 }];
const source = new OmeZarrImageSource(url);
const layer = new ImageLayer({
  source,
  region,
  contrastLimits: [sliderMin.valueAsNumber, sliderMax.valueAsNumber],
});
layerManager.add(layer);

sliderMin.addEventListener("input", (event) => {
  const minValue = (event.target as HTMLInputElement).valueAsNumber;
  console.debug("sliderMin: ", minValue);
  const maxValue = sliderMax.valueAsNumber;
  if (minValue >= maxValue) {
    sliderMin.value = (maxValue - Number(sliderMin.step)).toString();
  } else {
    layer.setContrastLimits([minValue, maxValue]);
  }
});
sliderMax.addEventListener("input", (event) => {
  const maxValue = (event.target as HTMLInputElement).valueAsNumber;
  console.debug("sliderMax: ", maxValue);
  const minValue = sliderMin.valueAsNumber;
  if (maxValue <= minValue) {
    sliderMax.value = (minValue + Number(sliderMax.step)).toString();
  } else {
    layer.setContrastLimits([minValue, maxValue]);
  }
});

function animate() {
  renderer.render(layerManager, camera);
  requestAnimationFrame(animate);
}

animate();
