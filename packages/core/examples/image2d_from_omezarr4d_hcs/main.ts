import {
  Idetik,
  ImageLayer,
  OrthographicCamera,
  OmeZarrImageSource,
  PanZoomControls,
  Region,
  loadOmeroChannels,
  loadOmeroDefaultZ,
  loadOmeZarrPlate,
  loadOmeZarrWell,
  Color,
} from "@";

const plateUrl =
  "https://public.czbiohub.org/organelle_box/datasets/A549/organelle_box_crop_v1.zarr/";
const initialWellPath = "CLTA/PFA";
const initialImagePath = "002000";
const LOW_RES_Z_SCALE = 0.78939; // micrometers per pixel
const HIGH_RES_NUM_SLICES = 38;

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

const camera = new OrthographicCamera(0, 840, 0, 360);
const controls = new PanZoomControls(camera);
const app = new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("canvas")!,
  camera,
  cameraControls: controls,
}).start();

const region: Region = [
  { dimension: "T", index: { type: "point", value: 0 } },
  { dimension: "Z", index: { type: "point", value: 0 } },
  { dimension: "C", index: { type: "full" } },
  { dimension: "Y", index: { type: "full" } },
  { dimension: "X", index: { type: "full" } },
];

const imageSelector = document.querySelector("#image") as HTMLSelectElement;

const onImageChange = async () => {
  console.debug("onImageChange: ", imageSelector.value);
  app.layerManager.removeAll();
  const imageUrl =
    plateUrl + "/" + wellSelector.value + "/" + imageSelector.value;
  const source = new OmeZarrImageSource(imageUrl);
  const omeroDefaultZ = await loadOmeroDefaultZ(source);
  region[1] = {
    dimension: "Z",
    index: {
      type: "point",
      value: (omeroDefaultZ / HIGH_RES_NUM_SLICES) * LOW_RES_Z_SCALE,
    },
  };
  const omeroChannels = await loadOmeroChannels(source);
  const channelProps = omeroChannels.map((ch) => ({
    color: Color.fromRgbHex(ch.color!),
    contrastLimits: [ch.window!.start, ch.window!.end] as [number, number],
  }));
  const newLayer = new ImageLayer({
    source,
    region,
    channelProps,
    lod: 0,
  });
  app.layerManager.add(newLayer);
  newLayer.addStateChangeCallback((state) => {
    if (state === "ready" && newLayer.extent) {
      camera.setFrame(0, newLayer.extent.x, 0, newLayer.extent.y);
      camera.update();
    }
  });
};

const onWellChange = async () => {
  console.debug("onWellChange: ", wellSelector.value);
  app.layerManager.removeAll();
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
