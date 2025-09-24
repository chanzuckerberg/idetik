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
import GUI from "lil-gui";

const url =
  "https://ome-zarr-scivis.s3.us-east-1.amazonaws.com/v0.5/96x2/marmoset_neurons.ome.zarr";
const source = new OmeZarrImageSource(url);
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
  camera,
  cameraControls,
  layers: [layer, axes],
}).start();

const controls = {
  sliceCoords,
  playZ: false,
  showWireframes: layer.debugMode,
  showAxes: idetik.layerManager.layers.includes(axes),
};

const gui = new GUI({ width: 500 });

const zMax = zInfo.offset + zInfo.size * zInfo.scale;
const zController = gui
  .add(controls.sliceCoords, "z", zInfo.offset, zMax, zInfo.scale)
  .name("Z-point");

class PlaybackController {
  private isPlaying_: boolean = false;
  private intervalId_?: number;
  private intervalMs_: number = 50;
  private stride_: number = 5;

  public play() {
    if (this.isPlaying_) return;
    this.intervalId_ = window.setInterval(() => {
      this.incrementTime();
    }, this.intervalMs_);
    this.isPlaying_ = true;
  }

  public pause() {
    if (!this.isPlaying_) return;
    if (this.intervalId_) {
      window.clearInterval(this.intervalId_);
      this.intervalId_ = undefined;
    }
    this.isPlaying_ = false;
  }

  private incrementTime = () => {
    const newValue = controls.sliceCoords.z + zInfo.scale * this.stride_;
    if (newValue <= zMax) {
      zController.setValue(newValue);
    } else {
      this.pause();
    }
  };
}

const playbackController = new PlaybackController();
gui
  .add(controls, "playZ")
  .name("Play Z")
  .onChange((play: boolean) => {
    if (play) {
      playbackController.play();
    } else {
      playbackController.pause();
    }
  });

gui
  .add(controls, "showWireframes")
  .name("Show tile wireframes")
  .onChange((show: boolean) => (layer.debugMode = show));

gui
  .add(controls, "showAxes")
  .name("Show axes")
  .onChange((show: boolean) => {
    if (show && !idetik.layerManager.layers.includes(axes)) {
      idetik.layerManager.add(axes);
    } else if (!show && idetik.layerManager.layers.includes(axes)) {
      idetik.layerManager.remove(axes);
    }
  });
