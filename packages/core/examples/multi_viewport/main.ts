import {
  Idetik,
  ChunkedImageLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  PerspectiveCamera,
  VolumeLayer,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";
import { OrbitControls } from "@/objects/cameras/orbit_controls";
import { addDimensionSlider } from "../lil_gui_utils";
import {
  // createExplorationPolicy,
  createPlaybackPolicy,
} from "@/core/image_source_policy";

import GUI from "lil-gui";

const url =
  "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/";
const left = 150;
const right = 950;
const top = 100;
const bottom = 900;

// values copied from source
const z = { translate: 0.0, scale: 1.24, shape: 448 };
const zMin = z.translate;
const zMax = z.translate + z.scale * z.shape - z.scale;

// Calculate volume center
const volumeCenter = [
  (left + right) / 2, // x center
  (top + bottom) / 2, // y center
  (zMin + zMax) / 2, // z center
] as [number, number, number];

// shared source between viewports
const source = new OmeZarrImageSource(url);

// Shared timepoint across all viewports
const sharedTimepoint = 400;

// Volume layer - no z coordinate to render entire volume
const volumeCoords = { t: sharedTimepoint, c: 0 };
const camera3D = new PerspectiveCamera();
const volumeLayer = new VolumeLayer({
  source,
  sliceCoords: volumeCoords,
  policy: createPlaybackPolicy(),
  transparent: true,
  blendMode: "premultiplied",
});

const sliceCoords = { t: sharedTimepoint, z: 300, c: 0 };
const camera2D = new OrthographicCamera(left, right, top, bottom);
camera2D.zoom(0.65);
const imageLayer = new ChunkedImageLayer({
  source,
  sliceCoords: sliceCoords,
  policy: createPlaybackPolicy(),
  channelProps: [{ contrastLimits: [0, 200] }],
});

new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("#canvas")!,
  viewports: [
    {
      id: "volume",
      element: document.querySelector<HTMLDivElement>("#viewport-left")!,
      camera: camera3D,
      cameraControls: new OrbitControls(camera3D, {
        radius: 1500,
        target: volumeCenter,
      }),
      layers: [volumeLayer],
    },
    {
      id: "slice",
      element: document.querySelector<HTMLDivElement>("#viewport-right")!,
      camera: camera2D,
      cameraControls: new PanZoomControls(camera2D),
      layers: [imageLayer],
    },
  ],
  showStats: true,
}).start();

const gui = new GUI({ width: 300 });

const sharedTime = { t: sharedTimepoint };
volumeCoords.t = sharedTime.t;
sliceCoords.t = sharedTime.t;

// Shared time slider for all viewports with playback controls
addDimensionSlider({
  gui: gui,
  sliceCoords: sharedTime,
  dimensionName: "t",
  minValue: 0,
  maxValue: 800,
  stepValue: 1,
  playback: {
    maxRateHz: 30,
    stride: 1,
    onRateChange: () => {
      // Sync the time value to all viewports
      volumeCoords.t = sharedTime.t;
      sliceCoords.t = sharedTime.t;
    },
  },
});

const zRange = { min: zMin, max: zMax };
addDimensionSlider({
  gui: gui,
  sliceCoords: sliceCoords,
  dimensionName: "z",
  minValue: zRange.min,
  maxValue: zRange.max,
  stepValue: z.scale,
});

// Keep all viewports synchronized by updating on every frame
const syncTime = () => {
  if (volumeCoords.t !== sharedTime.t) {
    volumeCoords.t = sharedTime.t;
  }
  if (sliceCoords.t !== sharedTime.t) {
    sliceCoords.t = sharedTime.t;
  }
  requestAnimationFrame(syncTime);
};
syncTime();

document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    const container = document.getElementById("container");
    if (container) {
      container.classList.toggle("fullscreen-mode");
    }
  }
});
