import { Idetik, VolumeLayer, PerspectiveCamera, OmeZarrImageSource } from "@";
import { OrbitControls } from "@/objects/cameras/orbit_controls";
import { createPlaybackPolicy } from "@/core/image_source_policy";
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
const controls = { lod: 2 };

const camera = new PerspectiveCamera();
const policy = createPlaybackPolicy({
  lod: { min: controls.lod, max: controls.lod },
});
const volumeLayer = new VolumeLayer({
  source,
  sliceCoords,
  policy,
  channelProps: [
    {
      visible: true,
      color: [1, 1, 1] as [number, number, number],
      contrastLimits: [0, 512] as [number, number],
    },
  ],
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
  playback: {},
});
gui
  .add(controls, "lod", 0, 2, 1)
  .name("Level of Detail (LOD)")
  .onChange(
    (lod: number) =>
      (volumeLayer.sourcePolicy = createPlaybackPolicy({
        lod: { min: lod, max: lod },
      }))
  );

const volumeFolder = gui.addFolder("Volume Rendering");
volumeFolder
  .add(volumeLayer, "relativeStepSize", 0.25, 3.0, 0.1)
  .name("Relative step size (voxels)");

// maps 0-1 slider to [0.001, 10.0] logarithmically
const opacityControls = {
  get opacity() {
    return (Math.log10(volumeLayer.opacityMultiplier) + 3) / 4;
  },
  set opacity(sliderValue: number) {
    volumeLayer.opacityMultiplier = Math.pow(10, sliderValue * 4 - 3);
  },
};
volumeFolder
  .add(opacityControls, "opacity", 0, 1, 0.01)
  .name("Opacity")
  .decimals(2);
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
