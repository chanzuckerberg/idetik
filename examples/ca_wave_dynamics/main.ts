import {
  ChannelProps,
  Idetik,
  ImageLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  Color,
  createNoPrefetchPolicy,
  createPlaybackPolicy,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";
import { addDimensionSlider } from "../lil_gui_utils";
import GUI from "lil-gui";

const url =
  "https://uk1s3.embassy.ebi.ac.uk/ebi-ngff-challenge-2024/c0e5d621-62cc-43a6-9dad-2ddab8959d17.zarr";

const source = OmeZarrImageSource.fromHttp({ url, version: "0.5" });

// Values copied from source metadata
const xyScale = 6.8746696041186794;
const left = 0;
const right = 1024 * xyScale;
const top = 0;
const bottom = 1024 * xyScale;

const tScale = 1.8112843;
const t = { translate: 0.0, scale: tScale, shape: 163 };
const tMin = t.translate;
const tMax = t.translate + t.scale * t.shape - t.scale;
const tRange = { min: tMin, max: tMax };

const sliceCoords = {
  t: tMin,
  z: 0,
  c: [1],
};

const channelProps: ChannelProps[] = [
  {
    visible: false,
  },
  {
    visible: true,
    contrastLimits: [409, 3000],
    color: Color.GREEN,
  },
];

const pausedPolicy = createNoPrefetchPolicy({
  lod: { min: 0, max: 1 },
});
const playbackPolicy = createPlaybackPolicy({
  lod: { min: 1, max: 2 },
});

const camera = new OrthographicCamera(left, right, top, bottom);
const imageLayer = new ImageLayer({
  source,
  sliceCoords,
  policy: pausedPolicy,
  channelProps,
});
imageLayer.debugMode = true;

const timePointDiv = document.querySelector<HTMLDivElement>("#time-point")!;
const timePointOverlay = {
  update(_idetik: Idetik, _timestamp?: DOMHighResTimeStamp) {
    const time = imageLayer.lastPresentationTimeCoord;
    timePointDiv.textContent = `t = ${time}`;
  },
};

new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("#canvas")!,
  viewports: [
    {
      camera,
      cameraControls: new PanZoomControls(camera),
      layers: [imageLayer],
    },
  ],
  overlays: [timePointOverlay],
  showStats: true,
}).start();

const controls = {
  showWireframes: imageLayer.debugMode,
  showTimePointOverlay: true,
};

const gui = new GUI({ width: 500 });

addDimensionSlider({
  gui,
  sliceCoords,
  dimensionName: "t",
  minValue: tRange.min,
  maxValue: tRange.max,
  stepValue: t.scale,
  playback: {
    onRateChange: (rateHz: number) => {
      imageLayer.imageSourcePolicy = rateHz > 0 ? playbackPolicy : pausedPolicy;
    },
  },
});

const overlaysFolder = gui.addFolder("Overlays");
overlaysFolder
  .add(controls, "showTimePointOverlay")
  .name("Show time point overlay")
  .onChange((show: boolean) => {
    timePointDiv.style.display = show ? "block" : "none";
  });
overlaysFolder
  .add(controls, "showWireframes")
  .name("Show tile wireframes")
  .onChange((show: boolean) => (imageLayer.debugMode = show));
