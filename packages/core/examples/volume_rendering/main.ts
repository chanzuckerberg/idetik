import { Idetik, VolumeLayer, PerspectiveCamera, OmeZarrImageSource } from "@";
import { OrbitControls } from "@/objects/cameras/orbit_controls";
import {
  createExplorationPolicy,
  createPlaybackPolicy,
} from "@/core/image_source_policy";
import { addDimensionSlider } from "../lil_gui_utils";
import GUI from "lil-gui";
import { vec3 } from "gl-matrix";

const url =
  "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/";
const source = OmeZarrImageSource.fromHttp({ url });
const sliceCoords = {
  t: 400,
  z: undefined,
  c: 0,
};

const camera = new PerspectiveCamera();
const policy = createExplorationPolicy({ lod: { min: 0, max: 2 } });
const volumeLayer = new VolumeLayer({
  source,
  sliceCoords,
  policy,
});
const idetik = new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("#canvas")!,
  viewports: [
    {
      camera: camera,
      cameraControls: new OrbitControls(camera, {
        radius: 750,
        target: vec3.fromValues(550, 500, 278), // Volume center,
      }),
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
  minValue: 0,
  maxValue: 800,
  stepValue: 1.0,
  playback: {
    onRateChange: (rateHz: number) => {
      volumeLayer.sourcePolicy =
        rateHz > 0 ? createPlaybackPolicy() : createExplorationPolicy();
    },
  },
});
gui
  .add(volumeLayer, "lod", policy.lod.min, policy.lod.max, 1)
  .name("Level of Detail (LOD)");

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
overlaysFolder.add(volumeLayer, "debugShowWireframe").name("Show tile wireframes");
overlaysFolder
  .add(volumeLayer, "debugShowDegenerateRays")
  .name("Show rays with length 0");
