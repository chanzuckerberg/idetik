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

// shared source between viewports
const source = new OmeZarrImageSource(url);

const camera3D = new PerspectiveCamera();
const volumeLayer = new VolumeLayer();

const sliceCoords1 = { t: 400, z: 200, c: 0 };
const camera2D1 = new OrthographicCamera(left, right, top, bottom);
const imageLayer1 = new ChunkedImageLayer({
  source,
  sliceCoords: sliceCoords1,
  policy: createExplorationPolicy(),
  channelProps: [{ contrastLimits: [0, 200] }],
});
const volumeLayer = new VolumeLayer({
  source,
  sliceCoords,
  policy: createExplorationPolicy(),
  transparent: true,
  blendMode: "premultiplied",
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
      id: "volume",
      element: document.querySelector<HTMLDivElement>("#viewport-left")!,
      camera: camera3D,
      cameraControls: new OrbitControls(camera3D, { radius: 3 }),
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
