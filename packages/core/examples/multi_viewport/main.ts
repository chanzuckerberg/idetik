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

const source = new OmeZarrImageSource(url);
const sliceCoords = { t: 400, z: 200, c: 0 };
const camera2D = new OrthographicCamera(left, right, top, bottom);
const imageLayer = new ChunkedImageLayer({
  source,
  sliceCoords,
  policy: createExplorationPolicy(),
  channelProps: [{ contrastLimits: [0, 200] }],
});

// TODO: the reason this example works is that the volume viewport uses a perspective camera
// otherwise the ChunkManager update causes interference between the two viewports
// this example can be updated to include multiple views of the same volume once we have
// better handling of multiple viewports using the same source
const camera3D = new PerspectiveCamera();

new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("#canvas")!,
  viewports: [
    {
      id: "volume",
      element: document.querySelector<HTMLDivElement>("#viewport-left")!,
      camera: camera3D,
      cameraControls: new OrbitControls(camera3D, { radius: 3 }),
      layers: [new VolumeLayer()],
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
addDimensionSlider({
  gui,
  sliceCoords,
  dimensionName: "z",
  minValue: zRange.min,
  maxValue: zRange.max,
  stepValue: z.scale,
});
