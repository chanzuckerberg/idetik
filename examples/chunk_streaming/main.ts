import {
  ChannelProps,
  Idetik,
  ChunkedImageLayer,
  OmeZarrImageSource,
  OrthographicCamera,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";
import { ChunkInfoOverlay } from "./chunk_info_overlay";
import { addDimensionSlider } from "../lil_gui_utils";
import {
  createExplorationPolicy,
  createPlaybackPolicy,
} from "@/core/image_source_policy";

import GUI from "lil-gui";

const url =
  "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/";
const left = 150;
const right = 950;
const top = 100;
const bottom = 900;

// Source is 5D, so provide indices at 3 dimensions to project to 2D.
const source = OmeZarrImageSource.fromHttp({ url });
const sliceCoords = {
  t: 400,
  z: 300,
  c: [0],
};

// values copied from source
const imageDataRange = { min: 0, max: 244 };
const z = { translate: 0.0, scale: 1.24, shape: 448 };
const zMin = z.translate;
const zMax = z.translate + z.scale * z.shape - z.scale;
const zRange = { min: zMin, max: zMax };

const t = { translate: 0.0, scale: 1.0, shape: 791 };
const tMin = t.translate;
const tMax = t.translate + t.scale * t.shape - t.scale;
const tRange = { min: tMin, max: tMax };

const initialWindow = 50;
const initialLevel = 25;
const initialContrastLimits = windowLevelToContrastLimits(
  initialWindow,
  initialLevel
);
const channelProps: ChannelProps[] = [
  { contrastLimits: initialContrastLimits },
];

const camera = new OrthographicCamera(left, right, top, bottom);
const imageLayer = new ChunkedImageLayer({
  source,
  sliceCoords,
  policy: createExplorationPolicy(),
  channelProps,
});
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
  viewports: [
    {
      camera,
      cameraControls: new PanZoomControls(camera),
      layers: [imageLayer],
    },
  ],
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
  dimensionName: "z",
  minValue: zRange.min,
  maxValue: zRange.max,
  stepValue: z.scale,
  playback: {},
});

addDimensionSlider({
  gui,
  sliceCoords,
  dimensionName: "t",
  minValue: tRange.min,
  maxValue: tRange.max,
  stepValue: t.scale,
  playback: {
    onRateChange: (rateHz: number) => {
      imageLayer.imageSourcePolicy =
        rateHz > 0 ? createPlaybackPolicy() : createExplorationPolicy();
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
  const newChannelProps = [{ contrastLimits }];
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
