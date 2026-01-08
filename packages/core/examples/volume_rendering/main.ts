import { Idetik, VolumeLayer, PerspectiveCamera, OmeZarrImageSource } from "@";
import { OrbitControls } from "@/objects/cameras/orbit_controls";
import { createExplorationPolicy } from "@/core/image_source_policy";
import { addDimensionSlider } from "../lil_gui_utils";
import GUI from "lil-gui";

const exampleType: "singleChannel" | "multiChannel" = "multiChannel";

const exampleSetupInfo = {
  singleChannel: {
    url: "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/",
    channelProps: [
      {
        visible: true,
        color: [1, 1, 1] as [number, number, number],
        contrastLimits: [0, 264] as [number, number],
      },
    ],
    radius: 4000,
  },
  multiChannel: {
    url: "https://public.czbiohub.org/organelle_box/datasets/A549/organelle_box_crop_v1.zarr/CLTA/PFA/002000/",
    channelProps: [
      {
        visible: false,
        color: [1, 1, 1] as [number, number, number],
        contrastLimits: [-1.5, 10.0] as [number, number],
      },
      {
        visible: true,
        color: [0, 0, 1] as [number, number, number],
        contrastLimits: [108, 353] as [number, number],
      },
      {
        visible: true,
        color: [0, 1, 0] as [number, number, number],
        contrastLimits: [144, 3825] as [number, number],
      },
    ],
    radius: 400,
  },
};

const { url, channelProps, radius } = exampleSetupInfo[exampleType];

// Normal code execution for either single-channel or multi-channel
const source = OmeZarrImageSource.fromHttp({ url });
const sliceCoords = {
  t: 0,
  z: undefined,
  c: undefined, // multi-channel rendering
};
const controls = { lod: 2 };

const camera = new PerspectiveCamera();
const policy = createExplorationPolicy({
  lod: { min: controls.lod, max: controls.lod },
});
const volumeLayer = new VolumeLayer({
  source,
  sliceCoords,
  policy,
  channelProps,
});
const idetik = new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("#canvas")!,
  viewports: [
    {
      camera: camera,
      cameraControls: new OrbitControls(camera, {
        radius: radius,
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
  playback: {},
});
gui
  .add(controls, "lod", 0, 2, 1)
  .name("Level of Detail (LOD)")
  .onChange(
    (lod: number) =>
      (volumeLayer.sourcePolicy = createExplorationPolicy({
        lod: { min: lod, max: lod },
      }))
  );

const volumeFolder = gui.addFolder("Volume Rendering");
volumeFolder
  .add(volumeLayer, "samplesPerUnit", 16, 512, 1)
  .name("Samples per unit");
volumeFolder.add(volumeLayer, "maxIntensity", 1, 255, 1).name("Max intensity");
volumeFolder
  .add(volumeLayer, "opacityMultiplier", 0.01, 1.0, 0.01)
  .name("Opacity scale");
volumeFolder
  .add(volumeLayer, "earlyTerminationAlpha", 0.8, 1.0, 0.01)
  .name("Early termination threshold");

const overlaysFolder = gui.addFolder("Debug");
overlaysFolder
  .add(volumeLayer, "debugShowWireframes")
  .name("Show tile wireframes");
overlaysFolder
  .add(volumeLayer, "debugShowDegenerateRays")
  .name("Show degenerate rays (length 0)");
