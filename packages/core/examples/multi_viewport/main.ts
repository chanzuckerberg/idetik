import {
  Idetik,
  ChunkedImageLayer,
  OmeZarrImageSource,
  OrthographicCamera,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";
import { addDimensionSlider } from "../lil_gui_utils";
import { createExplorationPolicy } from "@/core/image_source_policy";

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

// Shared source between two viewports
const source = new OmeZarrImageSource(url);

const sliceCoords1 = { t: 400, z: 200, c: 0 };
const camera2D1 = new OrthographicCamera(left, right, top, bottom);
const imageLayer1 = new ChunkedImageLayer({
  source,
  sliceCoords: sliceCoords1,
  policy: createExplorationPolicy(),
  channelProps: [{ contrastLimits: [0, 200] }],
});

const sliceCoords2 = { t: 400, z: 300, c: 0 };
const camera2D2 = new OrthographicCamera(left, right, top, bottom);
const imageLayer2 = new ChunkedImageLayer({
  source,
  sliceCoords: sliceCoords2,
  policy: createExplorationPolicy(),
  channelProps: [{ contrastLimits: [0, 200] }],
});

new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("#canvas")!,
  viewports: [
    {
      id: "slice1",
      element: document.querySelector<HTMLDivElement>("#viewport-left")!,
      camera: camera2D1,
      cameraControls: new PanZoomControls(camera2D1),
      layers: [imageLayer1],
    },
    {
      id: "slice2",
      element: document.querySelector<HTMLDivElement>("#viewport-right")!,
      camera: camera2D2,
      cameraControls: new PanZoomControls(camera2D2),
      layers: [imageLayer2],
    },
  ],
  showStats: true,
}).start();

const gui = new GUI({ width: 300 });

const leftViewportFolder = gui.addFolder("Left Viewport");
addDimensionSlider({
  gui: leftViewportFolder,
  sliceCoords: sliceCoords1,
  dimensionName: "z",
  minValue: zRange.min,
  maxValue: zRange.max,
  stepValue: z.scale,
});
leftViewportFolder.open();

const rightViewportFolder = gui.addFolder("Right Viewport");
addDimensionSlider({
  gui: rightViewportFolder,
  sliceCoords: sliceCoords2,
  dimensionName: "z",
  minValue: zRange.min,
  maxValue: zRange.max,
  stepValue: z.scale,
});
rightViewportFolder.open();
