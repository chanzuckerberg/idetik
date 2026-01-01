import { Idetik, VolumeLayer, PerspectiveCamera, OmeZarrImageSource } from "@";
import { OrbitControls } from "@/objects/cameras/orbit_controls";
import {
  createExplorationPolicy,
  createPlaybackPolicy,
} from "@/core/image_source_policy";
import { addDimensionSlider } from "../lil_gui_utils";
import GUI from "lil-gui";

const url =
  // "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/";
  "https://public.czbiohub.org/organelle_box/datasets/A549/organelle_box_crop_v1.zarr/CLTA/PFA/002000/";
const source = OmeZarrImageSource.fromHttp({ url });

const sliceCoords = {
  t: 0,
  z: undefined,
  c: undefined, // multi-channel rendering
};

const camera = new PerspectiveCamera();
const volumeLayer = new VolumeLayer({
  source,
  sliceCoords,
  policy: createExplorationPolicy(),
  lod: 2,
  channelProps: [
    { visible: true, color: [1, 1, 1], contrastLimits: [-1.5, 1.7] },
    { visible: true, color: [0, 0, 1], contrastLimits: [108, 353] },
    { visible: true, color: [0, 1, 0], contrastLimits: [144, 3825] },
  ],
});

const t = { translate: 0.0, scale: 1.0, shape: 791 };
const tMin = t.translate;
const tMax = t.translate + t.scale * t.shape - t.scale;
const tRange = { min: tMin, max: tMax };

const cameraControls = new OrbitControls(camera, { radius: 4000 });

const idetik = new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("#canvas")!,
  viewports: [
    {
      camera,
      cameraControls: cameraControls,
      layers: [volumeLayer],
    },
  ],
  showStats: true,
});

idetik.start();

// Add GUI controls to manipulate rendering
const gui = new GUI({ width: 500 });
addDimensionSlider({
  gui,
  sliceCoords,
  dimensionName: "t",
  minValue: tRange.min,
  maxValue: tRange.max,
  stepValue: t.scale,
  playback: {
    onRateChange: (rateHz: number) => {
      volumeLayer.sourcePolicy =
        rateHz > 0 ? createPlaybackPolicy() : createExplorationPolicy();
    },
  },
});
gui.add(volumeLayer, "lod", 0, 2, 1).name("Level of Detail (LOD)");

const volumeFolder = gui.addFolder("Volume Rendering");
volumeFolder
  .add(volumeLayer, "sampleDensity", 16, 512, 1)
  .name("Sample density");
volumeFolder.add(volumeLayer, "maxIntensity", 1, 255, 1).name("Max intensity");
volumeFolder
  .add(volumeLayer, "opacityScale", 0.01, 1.0, 0.01)
  .name("Opacity scale");
volumeFolder
  .add(volumeLayer, "alphaThreshold", 0.8, 1.0, 0.01)
  .name("Early termination threshold");

const overlaysFolder = gui.addFolder("Debug");
overlaysFolder.add(volumeLayer, "debugMode").name("Show tile wireframes");
overlaysFolder
  .add(volumeLayer, "showEmptyRays")
  .name("Show rays with length 0");
