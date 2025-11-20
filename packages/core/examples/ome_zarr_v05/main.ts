import {
  ChannelProps,
  Idetik,
  ChunkedImageLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  PointPickingResult,
} from "@";
import { AxesLayer } from "@/layers/axes_layer";
import { PanZoomControls } from "@/objects/cameras/controls";
import { addDimensionSlider } from "../lil_gui_utils";
import { createExplorationPolicy } from "@/core/image_source_policy";
import GUI from "lil-gui";

const url =
  "https://ome-zarr-scivis.s3.us-east-1.amazonaws.com/v0.5/96x2/marmoset_neurons.ome.zarr";
const source = OmeZarrImageSource.fromHttp({ url, version: "0.5" });
const loader = await source.open();
const attributes = loader.getAttributes();
const attributesAtLod0 = attributes[0];

const dimensionInfo = (dimensionName: string) => {
  const index = attributesAtLod0.dimensionNames.findIndex(
    (d) => d === dimensionName
  );
  return {
    size: attributesAtLod0.shape[index],
    scale: attributesAtLod0.scale[index],
    offset: attributesAtLod0.translation[index],
  };
};

const zInfo = dimensionInfo("z");
const zMidPoint = zInfo.offset + 0.5 * zInfo.size * zInfo.scale;
const yInfo = dimensionInfo("y");
const xInfo = dimensionInfo("x");

const sliceCoords = { z: zMidPoint };
const channelProps: ChannelProps[] = [{ contrastLimits: [0, 200] }];

const pickInfoDiv = document.querySelector<HTMLDivElement>("#pick-info")!;

const onPickValue = (info: PointPickingResult) => {
  const { world, value } = info;
  pickInfoDiv.innerHTML = `
    <strong>Pick Result:</strong><br/>
    World: (${world[0].toFixed(1)}, ${world[1].toFixed(1)}, ${world[2].toFixed(1)})<br/>
    Pixel Value: ${value}<br/>
  `;
};

const layer = new ChunkedImageLayer({
  source,
  sliceCoords,
  policy: createExplorationPolicy(),
  channelProps,
  onPickValue,
});
const axes = new AxesLayer({
  length: 0.75 * xInfo.scale * xInfo.size,
  width: 0.01,
});
const camera = new OrthographicCamera(
  xInfo.offset,
  xInfo.offset + xInfo.scale * xInfo.size,
  yInfo.offset,
  yInfo.offset + yInfo.scale * yInfo.size
);
const cameraControls = new PanZoomControls(camera);

const idetik = new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("canvas")!,
  viewports: [
    {
      camera,
      cameraControls,
      layers: [layer],
    },
  ],
}).start();

const viewport = idetik.viewports[0];

const controls = {
  showWireframes: layer.debugMode,
  showAxes: viewport.layerManager.layers.includes(axes),
};

const gui = new GUI({ width: 500 });

addDimensionSlider({
  gui,
  sliceCoords,
  dimensionName: "z",
  minValue: zInfo.offset,
  maxValue: zInfo.offset + (zInfo.size - 1) * zInfo.scale,
  stepValue: zInfo.scale,
  playback: {},
});

gui
  .add(controls, "showWireframes")
  .name("Show tile wireframes")
  .onChange((show: boolean) => (layer.debugMode = show));

gui
  .add(controls, "showAxes")
  .name("Show axes")
  .onChange((show: boolean) => {
    if (show && !viewport.layerManager.layers.includes(axes)) {
      viewport.layerManager.add(axes);
    } else if (!show && viewport.layerManager.layers.includes(axes)) {
      viewport.layerManager.remove(axes);
    }
  });
