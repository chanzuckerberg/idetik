import {
  Idetik,
  OmeZarrImageSource,
  OrthographicCamera,
  Region,
  ChunkedImageLayer,
} from "@";
import { LabelImageLayer } from "@/layers/label_image_layer";
import { PointPickingResult } from "@/layers/point_picking";
import { PanZoomControls } from "@/objects/cameras/controls";

// Use the same data sources as the existing example
const baseUrl = "https://public.czbiohub.org/organelle_box/datasets/A549";
const fovName = "B/3/000000";
const imageUrl = `${baseUrl}/2024_11_07_A549_SEC61_DENV_cropped.zarr/${fovName}`;
const labelsUrl = `${baseUrl}/2024_11_07_A549_SEC61_DENV_tracking.zarr/${fovName}`;

const imageSource = new OmeZarrImageSource(imageUrl);
const labelsSource = new OmeZarrImageSource(labelsUrl);

const lod = 0;
const loader = await imageSource.open();
const attributes = loader.getAttributes();
const attributesAtLod = attributes[lod];

// Phase contrast limits were chosen qualitatively.
const phaseChannelIndex = 0;
const phaseContrastLimits: [number, number] = [20, 200];

const tStartPoint = 0;

const dimensionExtent = (dimensionName: string) => {
  const index = attributesAtLod.dimensionNames.findIndex(
    (d) => d === dimensionName
  );
  return {
    size: attributesAtLod.shape[index],
    scale: attributesAtLod.scale[index],
  };
};

const zExtent = dimensionExtent("Z");
const zMidPoint = 0.5 * zExtent.size * zExtent.scale;
const xExtent = dimensionExtent("X");
const xStopPoint = xExtent.size * xExtent.scale;
const yExtent = dimensionExtent("Y");
const yStopPoint = yExtent.size * yExtent.scale;

const imageRegion: Region = [
  { dimension: "T", index: { type: "point", value: tStartPoint } },
  { dimension: "C", index: { type: "point", value: phaseChannelIndex } },
  { dimension: "Z", index: { type: "point", value: zMidPoint } },
  { dimension: "Y", index: { type: "full" } },
  { dimension: "X", index: { type: "full" } },
];

const labelsRegion: Region = [
  { dimension: "T", index: { type: "point", value: tStartPoint } },
  { dimension: "C", index: { type: "point", value: 0 } },
  { dimension: "Z", index: { type: "point", value: 0 } },
  { dimension: "Y", index: { type: "full" } },
  { dimension: "X", index: { type: "full" } },
];

// Get canvas elements
const canvas1 = document.querySelector<HTMLCanvasElement>("#canvas1")!;
const canvas2 = document.querySelector<HTMLCanvasElement>("#canvas2")!;

// Create cameras for both runtimes (same view)
const camera1 = new OrthographicCamera(0, xStopPoint, 0, yStopPoint);
const camera2 = new OrthographicCamera(0, xStopPoint, 0, yStopPoint);

// Create background image layers for both runtimes
const imageLayer1 = new ChunkedImageLayer({
  source: imageSource,
  region: imageRegion,
  transparent: true,
  channelProps: { contrastLimits: phaseContrastLimits },
});

const imageLayer2 = new ChunkedImageLayer({
  source: imageSource,
  region: imageRegion,
  transparent: true,
  channelProps: { contrastLimits: phaseContrastLimits },
});

// Create the shared LabelImageLayer that will be transferred
const sharedLabelLayer = new LabelImageLayer({
  source: labelsSource,
  region: labelsRegion,
  transparent: true,
  opacity: 0.5,
  blendMode: "normal",
  lod,
  outlineSelected: true,
  colorMap: {
    cycle: [
      [1.0, 0.0, 0.0], // Red
      [0.0, 1.0, 0.0], // Green
      [0.0, 0.0, 1.0], // Blue
      [1.0, 1.0, 0.0], // Yellow
      [1.0, 0.0, 1.0], // Magenta
      [0.0, 1.0, 1.0], // Cyan
    ],
  },
  onPickValue: (info: PointPickingResult) => {
    const { world, value } = info;
    console.log(`Picked value ${value} at world coordinates:`, world);

    // Update status to show picking still works
    updateStatus(
      `Picked value: ${value} at (${world[0].toFixed(1)}, ${world[1].toFixed(1)})`
    );
  },
});

// Create two Idetik runtimes
const runtime1 = new Idetik({
  canvas: canvas1,
  camera: camera1,
  layers: [imageLayer1, sharedLabelLayer], // Start with label layer in runtime 1
  cameraControls: new PanZoomControls(camera1),
});

const runtime2 = new Idetik({
  canvas: canvas2,
  camera: camera2,
  layers: [imageLayer2], // Start without label layer
  cameraControls: new PanZoomControls(camera2),
});

// Track which runtime currently has the label layer
let labelLayerInRuntime1 = true;

// Get UI elements
const transferToRuntime2Btn = document.querySelector<HTMLButtonElement>(
  "#transfer-to-runtime2"
)!;
const transferToRuntime1Btn = document.querySelector<HTMLButtonElement>(
  "#transfer-to-runtime1"
)!;
const statusDiv = document.querySelector<HTMLDivElement>("#status")!;

function updateStatus(message: string) {
  const baseMessage = labelLayerInRuntime1 ? "Runtime 1" : "Runtime 2";
  statusDiv.textContent = `Layer currently in: ${baseMessage} | ${message}`;
}

function updateButtonStates() {
  transferToRuntime1Btn.disabled = labelLayerInRuntime1;
  transferToRuntime2Btn.disabled = !labelLayerInRuntime1;
}

// Transfer layer from Runtime 1 to Runtime 2
transferToRuntime2Btn.addEventListener("click", () => {
  if (!labelLayerInRuntime1) return;

  console.log("Transferring layer from Runtime 1 to Runtime 2...");

  // Remove from runtime 1
  runtime1.layerManager.remove(sharedLabelLayer);

  // Add to runtime 2
  runtime2.layerManager.add(sharedLabelLayer);

  labelLayerInRuntime1 = false;
  updateStatus("Transfer to Runtime 2 completed");
  updateButtonStates();

  console.log("Transfer completed. Check if layer renders in Runtime 2.");
});

// Transfer layer from Runtime 2 to Runtime 1
transferToRuntime1Btn.addEventListener("click", () => {
  if (labelLayerInRuntime1) return;

  console.log("Transferring layer from Runtime 2 to Runtime 1...");

  // Remove from runtime 2
  runtime2.layerManager.remove(sharedLabelLayer);

  // Add to runtime 1
  runtime1.layerManager.add(sharedLabelLayer);

  labelLayerInRuntime1 = true;
  updateStatus("Transfer to Runtime 1 completed");
  updateButtonStates();

  console.log("Transfer completed. Check if layer renders in Runtime 1.");
});

// Initialize UI
updateButtonStates();
updateStatus("Initial setup");

// Start both runtimes
runtime1.start();
runtime2.start();

console.log(
  "Dual runtime example loaded. Use the buttons to transfer the LabelImageLayer between runtimes."
);
console.log(
  "Watch for rendering issues when the layer is moved to the new runtime."
);
