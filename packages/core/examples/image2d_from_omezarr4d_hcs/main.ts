import {
  Idetik,
  OrthographicCamera,
  OmeZarrImageSource,
  PanZoomControls,
  loadOmeroChannels,
  loadOmeroDefaults,
  loadOmeZarrPlate,
  loadOmeZarrWell,
  ChunkedImageLayer,
  createNoPrefetchPolicy,
} from "@";

import GUI from "lil-gui";
import { addDimensionSlider } from "../lil_gui_utils";

const plateUrl =
  "https://public.czbiohub.org/organelle_box/datasets/A549/organelle_box_crop_v1.zarr/";
const initialWellPath = "CLTA/PFA";
const initialImagePath = "002000";

const yScale = 0.1028358051168038;
const xScale = 0.10319840632897595;
const ySize = 800;
const xSize = 800;

const z = { translate: 0.0, scale: 0.19734794639973458, shape: 38 };
const zMin = z.translate;
const zMax = z.translate + z.scale * z.shape - z.scale;
const zRange = { min: zMin, max: zMax };

const plate = await loadOmeZarrPlate(plateUrl);
console.debug("plate", plate);
if (plate.plate === undefined) {
  throw new Error(`No plate found: ${plate}`);
}
const wellPaths = plate.plate.wells.map((well) => well.path);
const wellSelector = document.querySelector("#well") as HTMLSelectElement;
wellPaths.forEach((path) => {
  const option = document.createElement("option");
  option.value = path;
  option.text = path;
  wellSelector.appendChild(option);
  wellSelector.value = initialWellPath;
});

const policy = createNoPrefetchPolicy();

const camera = new OrthographicCamera(0, xSize * xScale, 0, ySize * yScale);
const app = new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("canvas")!,
  viewports: [
    {
      camera,
      cameraControls: new PanZoomControls(camera),
    },
  ],
}).start();

const viewport = app.viewports[0];
const imageSelector = document.querySelector("#image") as HTMLSelectElement;

const sliceCoords = { t: 0, z: 0, c: [1, 2] };

const onImageChange = async () => {
  console.debug("onImageChange: ", imageSelector.value);
  viewport.layerManager.removeAll();
  const imageUrl =
    plateUrl + "/" + wellSelector.value + "/" + imageSelector.value;
  const source = OmeZarrImageSource.fromHttp({ url: imageUrl });
  const omeroDefaults = await loadOmeroDefaults(source);
  const omeroDefaultZ = omeroDefaults?.defaultZ ?? 0;
  sliceCoords.z = (omeroDefaultZ / z.shape) * z.scale;

  const omeroChannels = await loadOmeroChannels(source);
  const contrastLimits: [number, number][] = [
    [omeroChannels[0].window!.start, omeroChannels[0].window!.end],
    [omeroChannels[1].window!.start, omeroChannels[1].window!.end],
    [omeroChannels[2].window!.start, omeroChannels[2].window!.end],
  ];

  const layer = new ChunkedImageLayer({
    source,
    sliceCoords,
    channelProps: [
      { color: [1, 1, 0], contrastLimits: contrastLimits[0] },
      { color: [0, 1, 1], contrastLimits: contrastLimits[1] },
      { color: [1, 0, 1], contrastLimits: contrastLimits[2] },
    ],
    transparent: true,
    opacity: 0.5,
    blendMode: "additive",
    policy,
  });
  viewport.layerManager.add(layer);
};

const onWellChange = async () => {
  console.debug("onWellChange: ", wellSelector.value);
  viewport.layerManager.removeAll();
  const path = wellSelector.value;
  const well = await loadOmeZarrWell(plateUrl, path);
  console.debug("well", well);
  if (well.well === undefined) {
    throw new Error(`No well found: ${well}`);
  }
  const imagePaths = well.well.images.map((image) => image.path);
  imageSelector.innerHTML = "";
  imagePaths.forEach((path) => {
    const option = document.createElement("option");
    option.value = path;
    option.text = path;
    imageSelector.appendChild(option);
    imageSelector.value = initialImagePath;
  });
  await onImageChange();
};

wellSelector.addEventListener("change", onWellChange);
imageSelector.addEventListener("change", onImageChange);

const loadInitialWell = async () => {
  await onWellChange();
};

loadInitialWell();

const gui = new GUI({ width: 500 });

addDimensionSlider({
  gui,
  sliceCoords,
  dimensionName: "z",
  minValue: zRange.min,
  maxValue: zRange.max,
  stepValue: z.scale,
  playback: {},
});
