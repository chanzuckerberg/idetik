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
const zRange = { min: zMin, max: zMax };

// Calculate volume center
const volumeCenter = [
  (left + right) / 2,  // x center
  (top + bottom) / 2,  // y center
  (zMin + zMax) / 2,   // z center
] as [number, number, number];

// shared source between viewports
const source = new OmeZarrImageSource(url);

// Shared timepoint across all viewports
const sharedTimepoint = 400;

// Volume layer - no z coordinate to render entire volume
const sliceCoordsVolume = { t: sharedTimepoint, c: 0 };
const camera3D = new PerspectiveCamera();
const volumeLayer = new VolumeLayer({
  source,
  sliceCoords: sliceCoordsVolume,
  policy: createPlaybackPolicy(),
  transparent: true,
  blendMode: "premultiplied",
});

const sliceCoords1 = { t: sharedTimepoint, z: 200, c: 0 };
const camera2D1 = new OrthographicCamera(left, right, top, bottom);
const imageLayer1 = new ChunkedImageLayer({
  source,
  sliceCoords: sliceCoords1,
  policy: createPlaybackPolicy(),
  channelProps: [{ contrastLimits: [0, 200] }],
});
imageLayer1.debugMode = true;

const sliceCoords2 = { t: sharedTimepoint, z: 300, c: 0 };
const camera2D2 = new OrthographicCamera(left, right, top, bottom);
const imageLayer2 = new ChunkedImageLayer({
  source,
  sliceCoords: sliceCoords2,
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
        target: volumeCenter
      }),
      layers: [volumeLayer],
    },
    {
      id: "slice1",
      element: document.querySelector<HTMLDivElement>("#viewport-top-right")!,
      camera: camera2D1,
      cameraControls: new PanZoomControls(camera2D1),
      layers: [imageLayer1],
    },
    {
      id: "slice2",
      element: document.querySelector<HTMLDivElement>(
        "#viewport-bottom-right"
      )!,
      camera: camera2D2,
      cameraControls: new PanZoomControls(camera2D2),
      layers: [imageLayer2],
    },
  ],
  showStats: true,
}).start();

const gui = new GUI({ width: 300 });

// Create a shared time object that all sliceCoords will reference
const sharedTime = { t: sharedTimepoint };
sliceCoordsVolume.t = sharedTime.t;
sliceCoords1.t = sharedTime.t;
sliceCoords2.t = sharedTime.t;

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
      sliceCoordsVolume.t = sharedTime.t;
      sliceCoords1.t = sharedTime.t;
      sliceCoords2.t = sharedTime.t;
    },
  },
});

// Keep all viewports synchronized by updating on every frame
const syncTime = () => {
  if (sliceCoordsVolume.t !== sharedTime.t) {
    sliceCoordsVolume.t = sharedTime.t;
  }
  if (sliceCoords1.t !== sharedTime.t) {
    sliceCoords1.t = sharedTime.t;
  }
  if (sliceCoords2.t !== sharedTime.t) {
    sliceCoords2.t = sharedTime.t;
  }
  requestAnimationFrame(syncTime);
};
syncTime();

const topRightViewportFolder = gui.addFolder("Top Right Viewport (Slice 1)");
addDimensionSlider({
  gui: topRightViewportFolder,
  sliceCoords: sliceCoords1,
  dimensionName: "z",
  minValue: zRange.min,
  maxValue: zRange.max,
  stepValue: z.scale,
});
topRightViewportFolder.open();

const bottomRightViewportFolder = gui.addFolder(
  "Bottom Right Viewport (Slice 2)"
);
addDimensionSlider({
  gui: bottomRightViewportFolder,
  sliceCoords: sliceCoords2,
  dimensionName: "z",
  minValue: zRange.min,
  maxValue: zRange.max,
  stepValue: z.scale,
});
bottomRightViewportFolder.open();
