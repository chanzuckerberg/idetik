import {
  Idetik,
  ChannelProps,
  ChunkedImageLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  ViewportConfig,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";
import {
  addDimensionSlider,
  preventGUIEventPropagation,
} from "../lil_gui_utils";
import GUI from "lil-gui";

const url =
  "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/";

const channelProps: ChannelProps[] = [{ contrastLimits: [0, 100] }];

// Camera bounds from chunk_streaming example
const left = 150;
const right = 950;
const top = 100;
const bottom = 900;

// Z dimension info
const z = { translate: 0.0, scale: 1.24, shape: 448 };
const zMin = z.translate;
const zMax = z.translate + z.scale * z.shape - z.scale;
const zRange = { min: zMin, max: zMax };

// T dimension info
const t = { translate: 0.0, scale: 1.0, shape: 791 };
const tMin = t.translate;
const tMax = t.translate + t.scale * t.shape - t.scale;
const tRange = { min: tMin, max: tMax };

const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!;
const viewportContainer = document.querySelector<HTMLDivElement>(
  "#viewport-container"
)!;

const sharedSource = new OmeZarrImageSource(url);

// Individual slice coordinates for each viewport
// They all reference the same object properties for t, so changing one changes all
const sliceCoords1 = { t: 400, z: 150, c: 0 };
const sliceCoords2 = { t: 400, z: 200, c: 0 };
const sliceCoords3 = { t: 400, z: 250, c: 0 };
const sliceCoords4 = { t: 400, z: 300, c: 0 };

// Grid state
const gridState = {
  horizontalSplit: 0.5, // fraction from top
  verticalSplit: 0.5, // fraction from left
};

let isDraggingHorizontal = false;
let isDraggingVertical = false;

function createViewportElements() {
  const elements = [];
  for (let i = 0; i < 4; i++) {
    const element = document.createElement("div");
    element.className = "viewport-overlay";
    element.id = `viewport-${i}`;

    const label = document.createElement("div");
    label.className = "viewport-label";
    label.textContent = `Viewport ${i + 1}`;
    element.appendChild(label);

    // Create container for viewport-specific GUI
    const guiContainer = document.createElement("div");
    guiContainer.className = "viewport-gui-container";
    guiContainer.id = `viewport-gui-${i}`;
    element.appendChild(guiContainer);

    viewportContainer.appendChild(element);
    elements.push(element);
  }
  return elements;
}

function createDividers() {
  const horizontalDivider = document.createElement("div");
  horizontalDivider.className = "divider horizontal-divider";
  horizontalDivider.id = "horizontal-divider";
  viewportContainer.appendChild(horizontalDivider);

  const verticalDivider = document.createElement("div");
  verticalDivider.className = "divider vertical-divider";
  verticalDivider.id = "vertical-divider";
  viewportContainer.appendChild(verticalDivider);

  // Add drag handlers
  horizontalDivider.addEventListener("mousedown", () => {
    isDraggingHorizontal = true;
  });

  verticalDivider.addEventListener("mousedown", () => {
    isDraggingVertical = true;
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDraggingHorizontal && !isDraggingVertical) return;

    const rect = canvas.getBoundingClientRect();

    if (isDraggingHorizontal) {
      const newSplit = (e.clientY - rect.top) / rect.height;
      gridState.horizontalSplit = Math.max(0.1, Math.min(0.9, newSplit));
      updateLayout();
    }

    if (isDraggingVertical) {
      const newSplit = (e.clientX - rect.left) / rect.width;
      gridState.verticalSplit = Math.max(0.1, Math.min(0.9, newSplit));
      updateLayout();
    }
  });

  document.addEventListener("mouseup", () => {
    isDraggingHorizontal = false;
    isDraggingVertical = false;
  });

  return { horizontalDivider, verticalDivider };
}

function updateLayout() {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  const splitX = gridState.verticalSplit * width;
  const splitY = gridState.horizontalSplit * height;

  // Update viewport positions
  viewportElements[0].style.left = "0px";
  viewportElements[0].style.top = "0px";
  viewportElements[0].style.width = `${splitX}px`;
  viewportElements[0].style.height = `${splitY}px`;

  viewportElements[1].style.left = `${splitX}px`;
  viewportElements[1].style.top = "0px";
  viewportElements[1].style.width = `${width - splitX}px`;
  viewportElements[1].style.height = `${splitY}px`;

  viewportElements[2].style.left = "0px";
  viewportElements[2].style.top = `${splitY}px`;
  viewportElements[2].style.width = `${splitX}px`;
  viewportElements[2].style.height = `${height - splitY}px`;

  viewportElements[3].style.left = `${splitX}px`;
  viewportElements[3].style.top = `${splitY}px`;
  viewportElements[3].style.width = `${width - splitX}px`;
  viewportElements[3].style.height = `${height - splitY}px`;

  // Update divider positions
  dividers.horizontalDivider.style.top = `${splitY}px`;
  dividers.verticalDivider.style.left = `${splitX}px`;
}

const viewportElements = createViewportElements();
const dividers = createDividers();

const camera1 = new OrthographicCamera(left, right, top, bottom);
const layer1 = new ChunkedImageLayer({
  source: sharedSource,
  sliceCoords: sliceCoords1,
  channelProps,
});

const camera2 = new OrthographicCamera(left, right, top, bottom);
const layer2 = new ChunkedImageLayer({
  source: sharedSource,
  sliceCoords: sliceCoords2,
  channelProps,
});

const camera3 = new OrthographicCamera(left, right, top, bottom);
const layer3 = new ChunkedImageLayer({
  source: sharedSource,
  sliceCoords: sliceCoords3,
  channelProps,
});

const camera4 = new OrthographicCamera(left, right, top, bottom);
const layer4 = new ChunkedImageLayer({
  source: sharedSource,
  sliceCoords: sliceCoords4,
  channelProps,
});

const viewports: ViewportConfig[] = [
  {
    id: "viewport-0",
    element: viewportElements[0],
    camera: camera1,
    cameraControls: new PanZoomControls(camera1),
    layers: [layer1],
  },
  {
    id: "viewport-1",
    element: viewportElements[1],
    camera: camera2,
    cameraControls: new PanZoomControls(camera2),
    layers: [layer2],
  },
  {
    id: "viewport-2",
    element: viewportElements[2],
    camera: camera3,
    cameraControls: new PanZoomControls(camera3),
    layers: [layer3],
  },
  {
    id: "viewport-3",
    element: viewportElements[3],
    camera: camera4,
    cameraControls: new PanZoomControls(camera4),
    layers: [layer4],
  },
];

updateLayout();

new Idetik({
  canvas,
  viewports,
  showStats: true,
}).start();

// Add window resize listener
window.addEventListener("resize", updateLayout);

const gui = new GUI({ width: 300 });

// Shared time control
const timeFolder = gui.addFolder("Time (Shared)");
timeFolder.open();

// Create a shared time object that we'll sync to all slice coords
const sharedTime = { t: sliceCoords1.t };

// Add the time slider and hook up onChange manually
const timeController = timeFolder
  .add(sharedTime, "t", tRange.min, tRange.max, t.scale)
  .name("t-coord")
  .onChange((value: number) => {
    sliceCoords1.t = value;
    sliceCoords2.t = value;
    sliceCoords3.t = value;
    sliceCoords4.t = value;
  });

// Add playback control
const playbackController = {
  rateHz: 0,
  intervalId: undefined as number | undefined,

  start() {
    if (this.intervalId !== undefined) {
      window.clearInterval(this.intervalId);
    }
    if (this.rateHz === 0) return;

    const intervalMs = 1000 / this.rateHz;
    this.intervalId = window.setInterval(() => {
      const newValue = sharedTime.t + t.scale;
      if (newValue <= tRange.max) {
        timeController.setValue(newValue);
      } else {
        timeController.setValue(tRange.min);
      }
    }, intervalMs);
  },
};

timeFolder
  .add(playbackController, "rateHz", 0, 30, 1)
  .name("t-playback rate (Hz)")
  .onChange((rateHz: number) => {
    // Enable prefetch time prioritization for all layers when playing
    const prioritize = rateHz > 0;
    if (layer1.chunkStoreView) {
      layer1.chunkStoreView.prioritizePrefetchTime = prioritize;
    }
    if (layer2.chunkStoreView) {
      layer2.chunkStoreView.prioritizePrefetchTime = prioritize;
    }
    if (layer3.chunkStoreView) {
      layer3.chunkStoreView.prioritizePrefetchTime = prioritize;
    }
    if (layer4.chunkStoreView) {
      layer4.chunkStoreView.prioritizePrefetchTime = prioritize;
    }
    playbackController.start();
  });

// Individual Z controls for each viewport - create GUIs inside each viewport
[
  { sliceCoords: sliceCoords1, label: "Viewport 1" },
  { sliceCoords: sliceCoords2, label: "Viewport 2" },
  { sliceCoords: sliceCoords3, label: "Viewport 3" },
  { sliceCoords: sliceCoords4, label: "Viewport 4" },
].forEach((config, index) => {
  const container = document.getElementById(`viewport-gui-${index}`)!;
  const viewportGui = new GUI({ container, width: 250 });
  viewportGui.title(`${config.label} Controls`);

  preventGUIEventPropagation(viewportGui);

  addDimensionSlider({
    gui: viewportGui,
    sliceCoords: config.sliceCoords,
    dimensionName: "z",
    minValue: zRange.min,
    maxValue: zRange.max,
    stepValue: z.scale,
    playback: {},
  });
});
