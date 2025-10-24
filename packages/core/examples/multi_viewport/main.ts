import {
  Idetik,
  ChunkedImageLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  PerspectiveCamera,
  VolumeLayer,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";
import { OrbitControls } from "@/objects/cameras/orbit_controls";
import { addDimensionSlider } from "../lil_gui_utils";
import {
  createExplorationPolicy,
  createPlaybackPolicy,
  createNoPrefetchPolicy,
} from "@/core/image_source_policy";
import { INTERNAL_POLICY_KEY } from "@/core/chunk_store_view";
import { ChunkSharingOverlay } from "./chunk_sharing_overlay";

import GUI from "lil-gui";

const url =
  "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/";
const left = 150;
const right = 950;
const top = 100;
const bottom = 900;

// values copied from source
const z = { translate: 0.0, scale: 1.24, shape: 448 };
const t = { translate: 0.0, scale: 1.0, shape: 791 };
const zMin = z.translate;
const zMax = z.translate + z.scale * z.shape - z.scale;
const tMin = t.translate;
const tMax = t.translate + t.scale * t.shape - t.scale;

// Shared source
const source = new OmeZarrImageSource(url);

// Slice coordinates for each viewport (independent by default)
const sliceCoords1 = { t: 400, z: 200, c: 0 };
const sliceCoords2 = { t: 400, z: 300, c: 0 };

const camera2D1 = new OrthographicCamera(left, right, top, bottom);
const imageLayer1 = new ChunkedImageLayer({
  source,
  sliceCoords: sliceCoords1,
  policy: createExplorationPolicy(),
  channelProps: [{ contrastLimits: [0, 200] }],
});

const camera2D2 = new OrthographicCamera(left, right, top, bottom);
const imageLayer2 = new ChunkedImageLayer({
  source,
  sliceCoords: sliceCoords2,
  policy: createPlaybackPolicy(),
  channelProps: [{ contrastLimits: [0, 200] }],
});

// Volume viewport
const camera3D = new PerspectiveCamera();

// Chunk sharing overlay
const chunkInfoDiv = document.querySelector<HTMLDivElement>("#chunk-info")!;
const chunkSharingOverlay = new ChunkSharingOverlay({
  textDiv: chunkInfoDiv,
  imageLayers: [imageLayer1, imageLayer2],
  viewportNames: ["Slice 1", "Slice 2"],
});

const idetik = new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("#canvas")!,
  viewports: [
    {
      id: "volume",
      element: document.querySelector<HTMLDivElement>("#viewport-volume")!,
      camera: camera3D,
      cameraControls: new OrbitControls(camera3D, { radius: 3 }),
      layers: [new VolumeLayer()],
    },
    {
      id: "slice1",
      element: document.querySelector<HTMLDivElement>("#viewport-slice1")!,
      camera: camera2D1,
      cameraControls: new PanZoomControls(camera2D1),
      layers: [imageLayer1],
    },
    {
      id: "slice2",
      element: document.querySelector<HTMLDivElement>("#viewport-slice2")!,
      camera: camera2D2,
      cameraControls: new PanZoomControls(camera2D2),
      layers: [imageLayer2],
    },
  ],
  overlays: [chunkSharingOverlay],
  showStats: true,
});

idetik.start();

// GUI setup in controls quadrant
const guiContainer = document.querySelector<HTMLDivElement>("#gui-container")!;
const gui = new GUI({ container: guiContainer, autoPlace: false });
gui.domElement.style.width = "100%";

const policyOptions = {
  Exploration: createExplorationPolicy(),
  Playback: createPlaybackPolicy(),
  "No Prefetch": createNoPrefetchPolicy(),
};

// Sync controls
const syncState = { syncTime: true };
const syncOnChange = () => {
  if (syncState.syncTime) {
    // When sync is enabled, make both coordinates reference the first one
    Object.defineProperty(sliceCoords2, "t", {
      get: () => sliceCoords1.t,
      set: (value) => {
        sliceCoords1.t = value;
        tSlider2.updateDisplay();
      },
      enumerable: true,
      configurable: true,
    });
    // Set up listener to sync slider2 when slider1 changes
    tSlider1.onChange(() => {
      tSlider2.updateDisplay();
    });
  } else {
    // When sync is disabled, give sliceCoords2 its own t value
    const currentT = sliceCoords1.t;
    delete (sliceCoords2 as Record<string, unknown>).t;
    sliceCoords2.t = currentT;
    // Remove the onChange listener by replacing it with a no-op
    tSlider1.onChange(() => {});
  }
};

gui.add(syncState, "syncTime").name("Sync Time").onChange(syncOnChange);

// Slice 1 controls
const slice1Folder = gui.addFolder("Slice 1");
const tSlider1 = addDimensionSlider({
  gui: slice1Folder,
  sliceCoords: sliceCoords1,
  dimensionName: "t",
  minValue: tMin,
  maxValue: tMax,
  stepValue: t.scale,
});
addDimensionSlider({
  gui: slice1Folder,
  sliceCoords: sliceCoords1,
  dimensionName: "z",
  minValue: zMin,
  maxValue: zMax,
  stepValue: z.scale,
});

const slice1State = { policy: "Exploration" };
slice1Folder
  .add(slice1State, "policy", Object.keys(policyOptions))
  .name("Loading Policy")
  .onChange((value: keyof typeof policyOptions) => {
    const newPolicy = policyOptions[value];
    const view = imageLayer1.chunkStoreView;
    if (view) {
      view.setImageSourcePolicy(newPolicy, INTERNAL_POLICY_KEY);
    }
  });
slice1Folder.open();

// Slice 2 controls
const slice2Folder = gui.addFolder("Slice 2");
const tSlider2 = addDimensionSlider({
  gui: slice2Folder,
  sliceCoords: sliceCoords2,
  dimensionName: "t",
  minValue: tMin,
  maxValue: tMax,
  stepValue: t.scale,
});
addDimensionSlider({
  gui: slice2Folder,
  sliceCoords: sliceCoords2,
  dimensionName: "z",
  minValue: zMin,
  maxValue: zMax,
  stepValue: z.scale,
});

const slice2State = { policy: "Playback" };
slice2Folder
  .add(slice2State, "policy", Object.keys(policyOptions))
  .name("Loading Policy")
  .onChange((value: keyof typeof policyOptions) => {
    const newPolicy = policyOptions[value];
    const view = imageLayer2.chunkStoreView;
    if (view) {
      view.setImageSourcePolicy(newPolicy, INTERNAL_POLICY_KEY);
    }
  });
slice2Folder.open();

// Initialize sync
syncOnChange();

// Tab switching
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const tabName = (tab as HTMLElement).dataset.tab;
    if (!tabName) return;

    // Update tab buttons
    document
      .querySelectorAll(".tab")
      .forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    // Update tab content
    document
      .querySelectorAll(".tab-content")
      .forEach((content) => content.classList.remove("active"));
    document.getElementById(`tab-${tabName}`)?.classList.add("active");
  });
});
