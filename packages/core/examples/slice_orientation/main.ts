import {
  Idetik,
  ChunkedImageLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  AxesLayer,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";
import { addDimensionSlider } from "../lil_gui_utils";
import { createExplorationPolicy } from "@/core/image_source_policy";

import GUI from "lil-gui";
import { quat } from "gl-matrix";

// wrap in async fn so we can query the source up front for image attributes
async function main() {
  const url =
    "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/";

  const source = OmeZarrImageSource.fromHttp({ url });

  const loader = await source.open();
  const dimensions = loader.getSourceDimensionMap();

  const x = dimensions.x.lods[0];
  const xMin = x.translation;
  const xMax = x.translation + x.scale * (x.size - 1);
  const xRange = { min: xMin, max: xMax };
  const xCenter = (xMin + xMax) / 2;

  const y = dimensions.y.lods[0];
  const yMin = y.translation;
  const yMax = y.translation + y.scale * (y.size - 1);
  const yRange = { min: yMin, max: yMax };
  const yCenter = (yMin + yMax) / 2;

  const z = dimensions.z!.lods[0];
  const zMin = z.translation;
  const zMax = z.translation + z.scale * (z.size - 1);
  const zRange = { min: zMin, max: zMax };
  const zCenter = (zMin + zMax) / 2;

  const camera = new OrthographicCamera(xMin, xMax, yMin, yMax, 0, 10000);
  camera.transform.setTranslation([xCenter, yCenter, zMax + 10]);

  let currentLayer = new ChunkedImageLayer({
    source,
    sliceCoords: { orientation: "xy", z: zCenter, t: 400, c: 0 },
    policy: createExplorationPolicy(),
    channelProps: [{ contrastLimits: [0, 200] }],
  });

  const axisLength = Math.max(xMax - xMin, yMax - yMin, zMax - zMin) * 0.3;

  const axisHelper = new AxesLayer({ length: axisLength, width: 0.01 });

  const idetik = new Idetik({
    canvas: document.querySelector<HTMLCanvasElement>("#canvas")!,
    viewports: [
      {
        camera,
        cameraControls: new PanZoomControls(camera),
        layers: [currentLayer, axisHelper],
      },
    ],
    showStats: true,
  }).start();

  const controls = {
    orientation: "xy" as "xy" | "xz" | "yz",
    showWireframes: false,
  };

  const gui = new GUI({ width: 300 });

  gui
    .add(controls, "showWireframes")
    .name("Show Tile Wireframes")
    .onChange((show: boolean) => {
      currentLayer.debugMode = show;
    });

  let dimensionSlider: ReturnType<typeof addDimensionSlider>;
  dimensionSlider = addDimensionSlider({
    gui,
    sliceCoords: currentLayer.sliceCoords,
    dimensionName: "z",
    minValue: zRange.min,
    maxValue: zRange.max,
    stepValue: z.scale,
  });

  gui
    .add(controls, "orientation", ["xy", "xz", "yz"])
    .name("Slice Orientation")
    .onChange((orientation: "xy" | "xz" | "yz") => {
      // Remove old dimension slider
      if (dimensionSlider) {
        dimensionSlider.destroy();
      }

      idetik.viewports[0].layerManager.remove(currentLayer);

      // update camera and create new layer based on orientation
      // need to create a new layer because SliceCoordinates.orientation is not mutable
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

      idetik.viewports[0].layerManager.add(currentLayer);
    });
}

main();
