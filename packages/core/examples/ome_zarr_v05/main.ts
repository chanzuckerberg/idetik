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
const source = new OmeZarrImageSource(url, "0.5");
const loader = await source.open();
const dimensions = loader.getSourceDimensionMap();
const lod = 0;

const zLod = dimensions.z!.lods[lod];
const zMidPoint = zLod.translation + 0.5 * zLod.size * zLod.scale;
const yLod = dimensions.y.lods[lod];
const xLod = dimensions.x.lods[lod];

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
  length: 0.75 * xLod.scale * xLod.size,
  width: 0.01,
});
const camera = new OrthographicCamera(
  xLod.translation,
  xLod.translation + xLod.scale * xLod.size,
  yLod.translation,
  yLod.translation + yLod.scale * yLod.size
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
  minValue: zLod.translation,
  maxValue: zLod.translation + (zLod.size - 1) * zLod.scale,
  stepValue: zLod.scale,
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
