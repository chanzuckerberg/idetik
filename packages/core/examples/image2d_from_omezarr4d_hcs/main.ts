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

const plateUrl =
  "https://public.czbiohub.org/organelle_box/datasets/A549/organelle_box_crop_v1.zarr/";
const initialWellPath = "CLTA/PFA";
const initialImagePath = "002000";
const LOW_RES_Z_SCALE = 0.78939; // micrometers per pixel
const HIGH_RES_NUM_SLICES = 38;

const yScale = 0.1028358051168038;
const xScale = 0.10319840632897595;
const ySize = 800;
const xSize = 800;

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

const onImageChange = async () => {
  console.debug("onImageChange: ", imageSelector.value);
  viewport.layerManager.removeAll();
  const imageUrl =
    plateUrl + "/" + wellSelector.value + "/" + imageSelector.value;
  const source = OmeZarrImageSource.fromHttp({ url: imageUrl });
  const omeroDefaults = await loadOmeroDefaults(source);
  const omeroDefaultZ = omeroDefaults?.defaultZ ?? 0;
  const initZ = (omeroDefaultZ / HIGH_RES_NUM_SLICES) * LOW_RES_Z_SCALE;

  const omeroChannels = await loadOmeroChannels(source);
  const contrastLimits: [number, number][] = [
    [omeroChannels[1].window!.start, omeroChannels[1].window!.end],
    [omeroChannels[2].window!.start, omeroChannels[2].window!.end],
  ];

  const layer1 = new ChunkedImageLayer({
    source,
    sliceCoords: { t: 0, z: initZ, c: 1 },
    channelProps: [{ color: [0, 1, 1], contrastLimits: contrastLimits[0] }],
    policy,
  });
  const layer2 = new ChunkedImageLayer({
    source,
    sliceCoords: { t: 0, z: initZ, c: 2 },
    channelProps: [{ color: [1, 0, 1], contrastLimits: contrastLimits[1] }],
    policy,
    transparent: true,
    blendMode: "additive",
    opacity: 1,
  });
  viewport.layerManager.add(layer1);
  viewport.layerManager.add(layer2);
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
