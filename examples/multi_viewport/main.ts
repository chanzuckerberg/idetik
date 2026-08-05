import {
  Idetik,
  ImageLayer,
  OmeZarrImageSource,
  OrbitControls,
  OrthographicCamera,
  PanZoomControls,
  PerspectiveCamera,
  SliceOrientation,
  VolumeLayer,
  createPlaybackPolicy,
} from "@";
import { addDimensionSlider } from "../lil_gui_utils";
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
const source = await OmeZarrImageSource.fromHttp({ url });

// Shared timepoint across all viewports
const sharedTime = { t: 400 };

// Volume layer - no z coordinate to render entire volume
const volumeCoords = {
  get t() {
    return sharedTime.t;
  },
  c: [0],
};
const camera3D = new PerspectiveCamera();
const volumeLayer = new VolumeLayer({
  source,
  sliceCoords: volumeCoords,
  policy: createPlaybackPolicy({ lod: { min: 2, max: 2 } }),
  channelProps: [{ contrastLimits: [0, 200] }],
});

const sliceCoords = {
  get t() {
    return sharedTime.t;
  },
  x: (left + right) / 2,
  y: (top + bottom) / 2,
  z: 300,
  c: [0],
};

function createSliceLayer(orientation: SliceOrientation) {
  return new ImageLayer({
    source,
    sliceCoords,
    policy: createPlaybackPolicy(),
    channelProps: [{ contrastLimits: [0, 200] }],
    orientation,
  });
}

function createSliceViewport(
  id: string,
  orientation: SliceOrientation,
  [uMin, uMax]: readonly [number, number],
  [vMin, vMax]: readonly [number, number]
) {
  const uPad = 0.2 * (uMax - uMin);
  const vPad = 0.2 * (vMax - vMin);
  const camera = new OrthographicCamera(
    uMin - uPad,
    uMax + uPad,
    vMin - vPad,
    vMax + vPad,
    { orientation }
  );

  return {
    id,
    element: document.querySelector<HTMLDivElement>(`#viewport-${id}`)!,
    camera,
    cameraControls: new PanZoomControls(camera),
    layers: [createSliceLayer(orientation)],
  };
}

const xRange = [left, right] as const;
const yRange = [top, bottom] as const;
const zRange = [zMin, zMax] as const;

new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("#canvas")!,
  viewports: [
    createSliceViewport("slice-xy", "XY", xRange, yRange),
    {
      id: "3d",
      element: document.querySelector<HTMLDivElement>("#viewport-3d")!,
      camera: camera3D,
      cameraControls: new OrbitControls(camera3D, {
        radius: 1100,
        yaw: 0.4,
        pitch: 0.1,
        target: volumeCenter,
      }),
      layers: [
        volumeLayer,
        createSliceLayer("XY"),
        createSliceLayer("XZ"),
        createSliceLayer("YZ"),
      ],
    },
    createSliceViewport("slice-xz", "XZ", xRange, zRange),
    createSliceViewport("slice-yz", "YZ", yRange, zRange),
  ],
  showStats: false,
}).start();

const gui = new GUI({ width: 300 });

addDimensionSlider({
  gui: gui,
  sliceCoords: sharedTime,
  dimensionName: "t",
  minValue: 0,
  maxValue: 790,
  stepValue: 1,
  playback: {
    maxRateHz: 30,
    stride: 1,
  },
});

addDimensionSlider({
  gui: gui,
  sliceCoords: sliceCoords,
  dimensionName: "x",
  minValue: left,
  maxValue: right,
  stepValue: 1,
});

addDimensionSlider({
  gui: gui,
  sliceCoords: sliceCoords,
  dimensionName: "y",
  minValue: top,
  maxValue: bottom,
  stepValue: 1,
});

addDimensionSlider({
  gui: gui,
  sliceCoords: sliceCoords,
  dimensionName: "z",
  minValue: zMin,
  maxValue: zMax,
  stepValue: z.scale,
});
