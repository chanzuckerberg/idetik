import {
  Idetik,
  ChunkedImageLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  PerspectiveCamera,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";
import { addDimensionSlider } from "../lil_gui_utils";
import { createExplorationPolicy } from "@/core/image_source_policy";

import GUI from "lil-gui";
import { LayerView } from "@/layers/layer_view";
import { OrbitControls } from "@/objects/cameras/orbit_controls";
import { quat } from "gl-matrix";

const url =
  "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/";

// Dimension values copied from source
const x = { translate: 0.0, scale: 1.24, shape: 800 };
const xMin = x.translate;
const xMax = x.translate + x.scale * (x.shape - 1);
const xRange = { min: xMin, max: xMax };

const y = { translate: 0.0, scale: 1.24, shape: 800 };
const yMin = y.translate;
const yMax = y.translate + y.scale * (y.shape - 1);
const yRange = { min: yMin, max: yMax };

const z = { translate: 0.0, scale: 1.24, shape: 448 };
const zMin = z.translate;
const zMax = z.translate + z.scale * (z.shape - 1);
const zRange = { min: zMin, max: zMax };

// Calculate center of the image data
const xCenter = (xMin + xMax) / 2;
const yCenter = (yMin + yMax) / 2;
const zCenter = (zMin + zMax) / 2;

// Shared source between all viewports
const source = OmeZarrImageSource.fromHttp({ url });

// Create three orthoslice layers (XY, XZ, YZ)
const sliceCoordsXY = { t: 400, z: zCenter, c: 0 };
const sliceCoordsXZ = { t: 400, y: yCenter, c: 0 };
const sliceCoordsYZ = { t: 400, x: xCenter, c: 0 };
// XY slice camera - looking down from above
const cameraXY = new OrthographicCamera(
  xMin, xMax, yMin, yMax,
  10,
  zMax - zMin + 20
);
cameraXY.transform.setTranslation([xCenter, yCenter, zMax + 10]);

const imageLayerXY = new ChunkedImageLayer({
  source,
  sliceCoords: sliceCoordsXY,
  policy: createExplorationPolicy(),
  channelProps: [{ contrastLimits: [0, 200] }],
});
imageLayerXY.debugMode = true;

// XZ slice camera - looking from the front
const cameraXZ = new OrthographicCamera(
  xMin, xMax, zMin, zMax,
  10,
  yMax - yMin + 20
);
cameraXZ.transform.setTranslation([xCenter, yMin - 10, zCenter]);
const rotationXZ = quat.create();
quat.rotateX(rotationXZ, rotationXZ, Math.PI / 2);
cameraXZ.transform.setRotation(rotationXZ);

const imageLayerXZ = new ChunkedImageLayer({
  source,
  sliceCoords: sliceCoordsXZ,
  policy: createExplorationPolicy(),
  channelProps: [{ contrastLimits: [0, 200] }],
});
imageLayerXZ.debugMode = true;

// YZ slice camera - looking from the side (along +X axis)
// YZ plane shows Y (horizontal) and Z (vertical)
const cameraYZ = new OrthographicCamera(
  yMin, yMax, zMin, zMax,
  10,
  xMax - xMin + 20
);
// Position camera to the left of the data, looking along +X
cameraYZ.transform.setTranslation([xMin - 10, yCenter, zCenter]);
// Rotate -90° around Y to face +X, then 90° around X to get Z up
const rotationYZ = quat.create();
quat.rotateY(rotationYZ, rotationYZ, -Math.PI / 2); // Face +X
quat.rotateZ(rotationYZ, rotationYZ, Math.PI / 2); // Rotate to get correct orientation
cameraYZ.transform.setRotation(rotationYZ);

const imageLayerYZ = new ChunkedImageLayer({
  source,
  sliceCoords: sliceCoordsYZ,
  policy: createExplorationPolicy(),
  channelProps: [{ contrastLimits: [0, 200] }],
});
imageLayerYZ.debugMode = true;

console.log("YZ slice coords:", sliceCoordsYZ);
console.log("YZ camera position:", cameraYZ.transform.translation);
console.log("YZ camera rotation:", cameraYZ.transform.rotation);

const camera3D = new PerspectiveCamera();

new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("#canvas")!,
  viewports: [
    {
      id: "xy",
      element: document.querySelector<HTMLDivElement>("#viewport-xy")!,
      camera: cameraXY,
      cameraControls: new PanZoomControls(cameraXY),
      layers: [imageLayerXY],
    },
    {
      id: "xz",
      element: document.querySelector<HTMLDivElement>("#viewport-xz")!,
      camera: cameraXZ,
      cameraControls: new PanZoomControls(cameraXZ),
      layers: [imageLayerXZ],
    },
    {
      id: "yz",
      element: document.querySelector<HTMLDivElement>("#viewport-yz")!,
      camera: cameraYZ,
      cameraControls: new PanZoomControls(cameraYZ),
      layers: [imageLayerYZ],
    },
    {
      id: "3D",
      element: document.querySelector<HTMLDivElement>("#viewport-3d")!,
      camera: camera3D,
      cameraControls: new OrbitControls(camera3D, {
        radius: 1000,
        target: [xCenter, yCenter, zCenter],
      }),
      layers: [new LayerView({ layers: [imageLayerXY, imageLayerXZ, imageLayerYZ] })],
    },
  ],
  showStats: true,
}).start();

const gui = new GUI({ width: 300 });

const xyFolder = gui.addFolder("XY Slice");
addDimensionSlider({
  gui: xyFolder,
  sliceCoords: sliceCoordsXY,
  dimensionName: "z",
  minValue: zRange.min,
  maxValue: zRange.max,
  stepValue: z.scale,
});
xyFolder.open();

const xzFolder = gui.addFolder("XZ Slice");
addDimensionSlider({
  gui: xzFolder,
  sliceCoords: sliceCoordsXZ,
  dimensionName: "y",
  minValue: yRange.min,
  maxValue: yRange.max,
  stepValue: y.scale,
});
xzFolder.open();

const yzFolder = gui.addFolder("YZ Slice");
addDimensionSlider({
  gui: yzFolder,
  sliceCoords: sliceCoordsYZ,
  dimensionName: "x",
  minValue: xRange.min,
  maxValue: xRange.max,
  stepValue: x.scale,
});
yzFolder.open();
