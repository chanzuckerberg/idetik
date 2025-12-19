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
import { createPlaybackPolicy } from "@/core/image_source_policy";

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

// shared source between viewports
const source = OmeZarrImageSource.fromHttp({ url });

// Shared timepoint across all viewports
const sharedTime = { t: 400 };

// Volume layer - no z coordinate to render entire volume
const volumeCoords = {
  get t() {
    return sharedTime.t;
  },
  c: 0,
};
const camera3D = new PerspectiveCamera();
const volumeLayer = new VolumeLayer({
  source,
  sliceCoords: volumeCoords,
  policy: createPlaybackPolicy(),
  lod: 2,
  transparent: true,
  blendMode: "premultiplied",
});

const camera2D = new OrthographicCamera(left, right, top, bottom);
camera2D.zoom(0.65);
const sliceCoords = {
  get t() {
    return sharedTime.t;
  },
  z: 300,
  c: 0,
};
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
