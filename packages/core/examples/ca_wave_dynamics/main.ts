import {
  ChannelProps,
  Idetik,
  ChunkedImageLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  Color,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";
import { ChunkInfoOverlay } from "./chunk_info_overlay";
import { addDimensionSlider } from "../lil_gui_utils";
import GUI from "lil-gui";

const url =
  "https://uk1s3.embassy.ebi.ac.uk/ebi-ngff-challenge-2024/c0e5d621-62cc-43a6-9dad-2ddab8959d17.zarr";

// Source is 5D, so provide indices at 3 dimensions to project to 2D.
const source = new OmeZarrImageSource(url);

// values copied from source
const imageDataRange = { min: 0, max: 3000 };

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

const initialWindow = 80;
const initialLevel = 10;
const initialContrastLimits = windowLevelToContrastLimits(
  initialWindow,
  initialLevel
);

const sliceCoords = {
  t: 0.5 * (tMin + tMax),
  z: 0,
  c: 1,
};

const channelColor = Color.GREEN;
const channelProps: ChannelProps[] = [
  { 
    contrastLimits: initialContrastLimits,
    color: channelColor,
  },
];

const camera = new OrthographicCamera(left, right, top, bottom);
const imageLayer = new ChunkedImageLayer({ source, sliceCoords, channelProps });
imageLayer.debugMode = true;

const overlaySelector = document.querySelector<HTMLDivElement>("#chunk-info")!;
const chunkInfoOverlay = new ChunkInfoOverlay({
  textDiv: overlaySelector,
  imageLayer: imageLayer,
});

const timePointDiv = document.querySelector<HTMLDivElement>("#time-point")!;
const timePointOverlay = {
  update(_idetik: Idetik, _timestamp?: DOMHighResTimeStamp) {
    const time = imageLayer.lastPresentationTimeCoord;
    timePointDiv.textContent = `t = ${time}`;
  },
};

new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("#canvas")!,
  camera,
  cameraControls: new PanZoomControls(camera),
  layers: [imageLayer],
  overlays: [chunkInfoOverlay, timePointOverlay],
  showStats: true,
}).start();

const controls = {
  showWireframes: imageLayer.debugMode,
  showChunkInfoOverlay: true,
  showTimePointOverlay: true,
  window: initialWindow,
  level: initialLevel,
  resetContrast: function () {
    contrastFolder.reset();
  },
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
      const source = imageLayer.chunkManagerSource;
      if (source) {
        source.prioritizePrefetchTime = rateHz > 0;
      }
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

overlaysFolder
  .add(controls, "showChunkInfoOverlay")
  .name("Show chunk information overlay")
  .onChange((show: boolean) => {
    overlaySelector.style.display = show ? "block" : "none";
  });

const contrastFolder = gui.addFolder("Window/Level");
contrastFolder
  .add(controls, "window", 1, 100, 1)
  .name("Window (%)")
  .onChange(updateContrastLimits);

contrastFolder
  .add(controls, "level", 0, 100, 1)
  .name("Level (%)")
  .onChange(updateContrastLimits);

contrastFolder.add(controls, "resetContrast").name("Reset");

function updateContrastLimits() {
  const contrastLimits = windowLevelToContrastLimits(
    controls.window,
    controls.level
  );
  const newChannelProps = [{ 
    contrastLimits,
    color: channelColor,
  }];
  imageLayer.setChannelProps(newChannelProps);
}

function windowLevelToContrastLimits(
  window: number,
  level: number
): [number, number] {
  return [
    (imageDataRange.max - imageDataRange.min) *
      (level / 100 - window / 100 / 2),
    (imageDataRange.max - imageDataRange.min) *
      (level / 100 + window / 100 / 2),
  ];
}
