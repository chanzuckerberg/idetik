import {
  ChannelProps,
  Idetik,
  ChunkedImageLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  createPlaybackPolicy,
  createExplorationPolicy,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";
import { ChunkInfoOverlay } from "../chunk_info_overlay";
import { addDimensionSlider } from "../lil_gui_utils";
import GUI from "lil-gui";

// Locally hosted s3 bucket: czi-dynamic-cell-atlas-staging
const url =
  "http://localhost:8000/emt_timelapse_dataset/3500006071_45_raw_converted.ome.zarr";

// Source is 5D, so provide indices at 3 dimensions to project to 2D.
const source = new OmeZarrImageSource(url);

const loader = await source.open();
const dimensions = loader.getSourceDimensionMap();
const x = dimensions.x.lods[0];
const y = dimensions.y.lods[0];
const z = dimensions.z!.lods[0];
const t = dimensions.t!.lods[0];

const imageDataRange = { min: 0, max: 512 };
const zMin = z.translation;
const zMax = z.translation + z.scale * z.size - z.scale;
const zRange = { min: zMin, max: zMax };

const tMin = t.translation;
const tMax = t.translation + t.scale * t.size - t.scale;
const tRange = { min: tMin, max: tMax };

const left = x.translation;
const right = x.translation + x.scale * x.size;
const top = y.translation;
const bottom = y.translation + y.scale * y.size;

const initialWindow = 60;
const initialLevel = 50;
const initialContrastLimits = windowLevelToContrastLimits(
  initialWindow,
  initialLevel
);
const channelProps: ChannelProps[] = [
  { contrastLimits: initialContrastLimits },
];

const sliceCoords = {
  t: 0.5 * (tMin + tMax),
  z: 0.5 * (zMin + zMax),
  c: 1,
};

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
