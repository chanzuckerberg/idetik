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
import { quat } from "gl-matrix";

const url =
  "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/";

// Dimension values copied from source
// Using (shape - 1) * scale to get the center of the last pixel, not the edge
const x = { translate: 0.0, scale: 1.24, shape: 800 };
const xMin = x.translate;
const xMax = x.translate + x.scale * (x.shape - 1);
const xRange = { min: xMin, max: xMax };
const xCenter = (xMin + xMax) / 2;

const y = { translate: 0.0, scale: 1.24, shape: 800 };
const yMin = y.translate;
const yMax = y.translate + y.scale * (y.shape - 1);
const yRange = { min: yMin, max: yMax };
const yCenter = (yMin + yMax) / 2;

const z = { translate: 0.0, scale: 1.24, shape: 448 };
const zMin = z.translate;
const zMax = z.translate + z.scale * (z.shape - 1);
const zRange = { min: zMin, max: zMax };
const zCenter = (zMin + zMax) / 2;

// Shared source
const source = OmeZarrImageSource.fromHttp({ url });

// Camera - use generous near/far that works for all orientations
const camera = new OrthographicCamera(xMin, xMax, yMin, yMax, -100, 2000);
camera.transform.setTranslation([xCenter, yCenter, zMax + 10]);

// Start with XY orientation
let currentLayer = new ChunkedImageLayer({
  source,
  sliceCoords: { orientation: "xy", z: zCenter, t: 400, c: 0 },
  policy: createExplorationPolicy(),
  channelProps: [{ contrastLimits: [0, 200] }],
});

const idetik = new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("#canvas")!,
  viewports: [
    {
      camera,
      cameraControls: new PanZoomControls(camera),
      layers: [currentLayer],
    },
  ],
  showStats: true,
}).start();

const controls = {
  orientation: "xy" as "xy" | "xz" | "yz",
  showWireframes: false,
};

const gui = new GUI({ width: 300 });

// Wireframe toggle
gui
  .add(controls, "showWireframes")
  .name("Show Tile Wireframes")
  .onChange((show: boolean) => {
    currentLayer.debugMode = show;
  });

let dimensionSlider: ReturnType<typeof addDimensionSlider>;

// Orientation selector
gui
  .add(controls, "orientation", ["xy", "xz", "yz"])
  .name("Slice Orientation")
  .onChange((orientation: "xy" | "xz" | "yz") => {
    // Remove old dimension slider
    if (dimensionSlider) {
      dimensionSlider.destroy();
    }

    // Remove old layer
    idetik.viewports[0].layerManager.remove(currentLayer);

    // Update camera and create new layer based on orientation
    switch (orientation) {
      case "xy": {
        // XY slice: looking down from above (along -Z)
        camera.setFrame(xMin, xMax, yMin, yMax);
        camera.transform.setTranslation([xCenter, yCenter, zMax + 10]);
        camera.transform.setRotation(quat.create());

        currentLayer = new ChunkedImageLayer({
          source,
          sliceCoords: { orientation: "xy", z: zCenter, t: 400, c: 0 },
          policy: createExplorationPolicy(),
          channelProps: [{ contrastLimits: [0, 200] }],
        });
        currentLayer.debugMode = controls.showWireframes;

        dimensionSlider = addDimensionSlider({
          gui,
          sliceCoords: currentLayer.sliceCoords,
          dimensionName: "z",
          minValue: zRange.min,
          maxValue: zRange.max,
          stepValue: z.scale,
        });
        break;
      }

      case "xz": {
        // XZ slice: looking from the front (along -Y)
        camera.setFrame(xMin, xMax, zMin, zMax);
        camera.transform.setTranslation([xCenter, yMin - 10, zCenter]);
        const rotationXZ = quat.create();
        quat.rotateX(rotationXZ, rotationXZ, Math.PI / 2);
        camera.transform.setRotation(rotationXZ);

        currentLayer = new ChunkedImageLayer({
          source,
          sliceCoords: { orientation: "xz", y: yCenter, t: 400, c: 0 },
          policy: createExplorationPolicy(),
          channelProps: [{ contrastLimits: [0, 200] }],
        });
        currentLayer.debugMode = controls.showWireframes;

        dimensionSlider = addDimensionSlider({
          gui,
          sliceCoords: currentLayer.sliceCoords,
          dimensionName: "y",
          minValue: yRange.min,
          maxValue: yRange.max,
          stepValue: y.scale,
        });
        break;
      }

      case "yz": {
        // YZ slice: looking from the side (along -X)
        camera.setFrame(yMin, yMax, zMin, zMax);
        camera.transform.setTranslation([xMin - 10, yCenter, zCenter]);
        const rotationYZ = quat.create();
        quat.rotateY(rotationYZ, rotationYZ, -Math.PI / 2);
        quat.rotateZ(rotationYZ, rotationYZ, Math.PI / 2);
        camera.transform.setRotation(rotationYZ);

        currentLayer = new ChunkedImageLayer({
          source,
          sliceCoords: { orientation: "yz", x: xCenter, t: 400, c: 0 },
          policy: createExplorationPolicy(),
          channelProps: [{ contrastLimits: [0, 200] }],
        });
        currentLayer.debugMode = controls.showWireframes;

        dimensionSlider = addDimensionSlider({
          gui,
          sliceCoords: currentLayer.sliceCoords,
          dimensionName: "x",
          minValue: xRange.min,
          maxValue: xRange.max,
          stepValue: x.scale,
        });
        break;
      }
    }

    // Add new layer to viewport
    idetik.viewports[0].layerManager.add(currentLayer);
  });

// Initial dimension slider (Z for XY orientation)
dimensionSlider = addDimensionSlider({
  gui,
  sliceCoords: currentLayer.sliceCoords,
  dimensionName: "z",
  minValue: zRange.min,
  maxValue: zRange.max,
  stepValue: z.scale,
});
