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
import { SliceCoordinates } from "@/data/slice_coordinates";
import { vec3 } from "gl-matrix";

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

const volumeCenter = vec3.fromValues(
  (right + left) / 2,
  (top + bottom) / 2,
  (zMin + zMax) / 2
);

// shared source between viewports
const source = OmeZarrImageSource.fromHttp({ url });

// Shared timepoint across all viewports
const sharedTime = { orientation: "volume", t: 400 } satisfies SliceCoordinates;

// Volume layer - no z coordinate to render entire volume
const volumeCoords = {
  orientation: "volume",
  get t() {
    return sharedTime.t;
  },
  c: 0,
} satisfies SliceCoordinates;
const camera3D = new PerspectiveCamera();
const volumeLayer = new VolumeLayer({
  source,
  sliceCoords: volumeCoords,
  policy: createPlaybackPolicy({ lod: { min: 2, max: 2 } }),
});

const camera2D = new OrthographicCamera(left, right, top, bottom, -1000, 1000);
camera2D.transform.setTranslation([
  (left + right) / 2,
  (top + bottom) / 2,
  zMax + 10,
]);
const sliceCoords = {
  orientation: "xy",
  get t() {
    return sharedTime.t;
  },
  z: 300,
  c: 0,
} satisfies SliceCoordinates;
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
        radius: 750,
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
