import {
  Idetik,
  OmeZarrImageSource,
  OrthographicCamera,
  Region,
  Color,
  ImageLayer,
} from "@";
import {
  LabelImageLayer,
  PointPickingResult,
} from "@/layers/label_image_layer";
import { PanZoomControls } from "@/objects/cameras/controls";

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
const attributes = await loader.loadAttributes();
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

// Create base image layer
const imageLayer = new ImageLayer({
  source: imageSource,
  region: imageRegion,
  transparent: true,
  channelProps: [
    {
      visible: true,
      color: Color.WHITE,
      contrastLimits: phaseContrastLimits,
    },
  ],
  lod,
});

// Create label image layer with picking functionality
const labelsLayer = new LabelImageLayer({
  source: labelsSource,
  region: labelsRegion,
  transparent: true,
  opacity: 0.25,
  blendMode: "normal",
  lod,
  colorCycle: [Color.YELLOW, Color.MAGENTA, Color.CYAN],
  colorMap: new Map([[103, Color.GREEN]]),
  onPickValue: (info: PointPickingResult) => {
    const { world, value } = info;
    pickInfoDiv.innerHTML = `
      <strong>Pick Result:</strong><br/>
      World: (${world[0].toFixed(1)}, ${world[1].toFixed(1)}, ${world[2].toFixed(1)})<br/>
      Value: ${value ?? "null"}<br/>
    `;
  },
});

const idetik = new Idetik({
  canvas,
  camera,
  layers: [imageLayer, labelsLayer],
  controls: new PanZoomControls(camera, camera.position),
});

idetik.start();
