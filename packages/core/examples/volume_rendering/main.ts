import { Idetik, VolumeLayer, PerspectiveCamera, OmeZarrImageSource } from "@";
import { OrbitControls } from "@/objects/cameras/orbit_controls";
import {
  createExplorationPolicy,
  createPlaybackPolicy,
} from "@/core/image_source_policy";
import { addDimensionSlider } from "../lil_gui_utils";
import GUI from "lil-gui";

const url =
  "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/";
const source = new OmeZarrImageSource(url);
const left = 150;
const right = 950;
const top = 100;
const bottom = 900;


const sliceCoords = {
  t: 400,
  z: undefined,
  c: 0,
};

// values copied from source
const z = { translate: 0.0, scale: 1.24, shape: 448 };
const zMin = z.translate;
const zMax = z.translate + z.scale * z.shape - z.scale;

// calculate volume center
const volumeCenter = [
  (left + right) / 2, // x center
  (top + bottom) / 2, // y center
  (zMin + zMax) / 2, // z center
] as [number, number, number];

const camera = new PerspectiveCamera();
const volumeLayer = new VolumeLayer({
  source,
  sliceCoords,
  policy: createExplorationPolicy(),
});
// volumeLayer.debugMode = true;

// Largely copied from chunk streaming example
const t = { translate: 0.0, scale: 1.0, shape: 791 };
const tMin = t.translate;
const tMax = t.translate + t.scale * t.shape - t.scale;
const tRange = { min: tMin, max: tMax };
const timePointDiv = document.querySelector<HTMLDivElement>("#time-point")!;
const timePointOverlay = {
  update(_idetik: Idetik, _timestamp?: DOMHighResTimeStamp) {
    const time = sliceCoords.t;
    timePointDiv.textContent = `t = ${time}`;
  },
};
const lodOverlayDiv = document.querySelector<HTMLDivElement>("#lod")!;
const lodOverlay = {
  update(_idetik: Idetik, _timestamp?: DOMHighResTimeStamp) {
    lodOverlayDiv.textContent = `LOD: ${volumeLayer.lod}`;
  },
};

const idetik = new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("#canvas")!,
  viewports: [
    {
      camera,
      cameraControls: new OrbitControls(camera, { radius: 1200, target: volumeCenter }),
      layers: [volumeLayer],
    },
  ],
  overlays: [timePointOverlay, lodOverlay],
  showStats: true,
});

idetik.start();

const controls = {
  showWireframes: volumeLayer.debugMode,
  showTimePointOverlay: true,
  showLodOverlay: true,
  showHitMisses: false,
  lod: 2,
};

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

const overlaysFolder = gui.addFolder("Overlays");

overlaysFolder
  .add(controls, "showTimePointOverlay")
  .name("Show time point overlay")
  .onChange((show: boolean) => {
    timePointDiv.style.display = show ? "block" : "none";
  });

overlaysFolder
  .add(controls, "showLodOverlay")
  .name("Show LOD overlay")
  .onChange((show: boolean) => {
    lodOverlayDiv.style.display = show ? "block" : "none";
  });

overlaysFolder
  .add(controls, "showWireframes")
  .name("Show tile wireframes")
  .onChange((show: boolean) => {
    volumeLayer.debugMode = show;
    controls.showWireframes = show;
  });

overlaysFolder
  .add(controls, "showHitMisses")
  .name("Show Hit Misses")
  .onChange((show: boolean) => {
    controls.showHitMisses = show;
    volumeLayer.hitMisses = show;
  });

const volumeFolder = gui.addFolder("Volume Rendering");

volumeFolder
  .add(controls, "lod", 0, 2, 1)
  .name("Level of Detail (LOD)")
  .onChange((lod: number) => {
    volumeLayer.lod = lod;
    controls.lod = lod;
  });

volumeFolder
  .add(volumeLayer, "sampleDensity", 16, 512, 1)
  .name("Sample Density");

volumeFolder.add(volumeLayer, "maxIntensity", 1, 255, 1).name("Max Intensity");

volumeFolder
  .add(volumeLayer, "opacityScale", 0.01, 1.0, 0.01)
  .name("Opacity Scale");

volumeFolder
  .add(volumeLayer, "alphaThreshold", 0.5, 1.0, 0.01)
  .name("Alpha Threshold");
