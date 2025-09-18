import {
  ChannelProps,
  Idetik,
  ChunkedImageLayer,
  OmeZarrImageSource,
  OrthographicCamera,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";
import { ChunkInfoOverlay } from "./chunk_info_overlay";
import GUI from "lil-gui";

const url =
  "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/";
const left = 150;
const right = 950;
const top = 100;
const bottom = 900;

// Source is 5D, so provide indices at 3 dimensions to project to 2D.
const source = new OmeZarrImageSource(url);
const sliceCoords = {
  t: 400,
  z: 300,
  c: 0,
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
const imageLayer = new ChunkedImageLayer({ source, sliceCoords, channelProps });
imageLayer.debugMode = true;

const overlaySelector = document.querySelector<HTMLDivElement>("#chunk-info")!;
const chunkInfoOverlay = new ChunkInfoOverlay({
  textDiv: overlaySelector,
  imageLayer: imageLayer,
});

new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("#canvas")!,
  camera,
  cameraControls: new PanZoomControls(camera),
  layers: [imageLayer],
  overlays: [chunkInfoOverlay],
  showStats: true,
}).start();

const controls = {
  sliceCoords,
  showWireframes: true,
  showChunkInfoOverlay: true,
  window: initialWindow,
  level: initialLevel,
  resetContrast: function () {
    contrastFolder.reset();
  },
};

const gui = new GUI({ width: 500 });

gui
  .add(controls.sliceCoords, "z", zRange.min, zRange.max, z.scale)
  .name("Z-point");

gui
  .add(controls.sliceCoords, "t", tRange.min, tRange.max, t.scale)
  .name("T-point");

gui
  .add(controls, "showWireframes")
  .name("Show tile wireframes")
  .onChange((show: boolean) => (imageLayer.debugMode = show));

gui
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
