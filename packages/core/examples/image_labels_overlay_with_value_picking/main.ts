import {
  Idetik,
  OmeZarrImageSource,
  OrthographicCamera,
  Region,
  Color,
  ChunkedImageLayer,
} from "@";
import { LabelImageLayer } from "@/layers/label_image_layer";
import { PointPickingResult } from "@/layers/point_picking";
import { PanZoomControls } from "@/objects/cameras/controls";
import { createExplorationPolicy } from "@/core/image_source_policy";

// These roughly correspond in terms of content and the number of time-points.
// But the image is smaller in XY than the labels, and has a Z-stack, so it
// is unclear which Z-slice the labels correspond to (if any particular one)
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

const sliceCoords = {
  t: tStartPoint,
  c: phaseChannelIndex,
  z: zMidPoint,
};

// Labels provide C and Z dimensions, but they are unitary.
const labelsRegion: Region = [
  { dimension: "T", index: { type: "point", value: tStartPoint } },
  { dimension: "C", index: { type: "point", value: 0 } },
  { dimension: "Z", index: { type: "point", value: 0 } },
  { dimension: "Y", index: { type: "full" } },
  { dimension: "X", index: { type: "full" } },
];

const camera = new OrthographicCamera(0, xStopPoint, 0, yStopPoint);
const canvas = document.querySelector<HTMLCanvasElement>("canvas")!;

// Get the info div for displaying pick results
const pickInfoDiv = document.querySelector<HTMLDivElement>("#pick-info")!;

// Add outline mode toggle
let outlineMode = false;
const infoBox = document.querySelector<HTMLDivElement>("#info-box")!;
const toggleDiv = document.createElement("div");
toggleDiv.innerHTML =
  '<strong>Mode:</strong> <span id="mode-text" style="cursor: pointer; text-decoration: underline;">Fill</span>';
toggleDiv.style.cursor = "pointer";
infoBox.appendChild(toggleDiv);

// Create base image layer
const imageLayer = new ChunkedImageLayer({
  source: imageSource,
  sliceCoords,
  policy: createExplorationPolicy(),
  transparent: true,
  channelProps: [{ contrastLimits: phaseContrastLimits }],
});

// Function to create label layer with current mode
function createLabelsLayer() {
  return new LabelImageLayer({
    source: labelsSource,
    region: labelsRegion,
    transparent: true,
    opacity: 0.25,
    blendMode: "normal",
    lod,
    outlineSelected: outlineMode,
    onPickValue: (info: PointPickingResult) => {
      const { world, value } = info;
      pickInfoDiv.innerHTML = `
        <strong>Pick Result:</strong><br/>
        World: (${world[0].toFixed(1)}, ${world[1].toFixed(1)}, ${world[2].toFixed(1)})<br/>
        Label Value: ${value}
      `;

      if (outlineMode) {
        // In outline mode, the layer handles the selection internally
      } else {
        // In fill mode, use the old white fill behavior
        labelsLayer.setColorMap({
          cycle: Array.from(labelsLayer.colorMap.cycle),
          lookupTable: new Map([[value, Color.WHITE]]),
        });
      }
    },
  });
}

// Create initial label layer
let labelsLayer = createLabelsLayer();

// Create Idetik instance
const idetik = new Idetik({
  canvas,
  viewports: [
    {
      camera,
      cameraControls: new PanZoomControls(camera),
      layers: [imageLayer, labelsLayer],
    },
  ],
});

const viewport = idetik.viewports[0];

// Add toggle functionality
const modeText = document.querySelector<HTMLSpanElement>("#mode-text")!;
toggleDiv.addEventListener("click", () => {
  outlineMode = !outlineMode;
  modeText.textContent = outlineMode ? "Outline" : "Fill";

  // Remove old layer and create new one with updated mode
  viewport.layerManager.remove(labelsLayer);
  labelsLayer = createLabelsLayer();
  viewport.layerManager.add(labelsLayer);
});

idetik.start();
