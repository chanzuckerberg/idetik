import {
  Idetik,
  OmeZarrImageSource,
  OrthographicCamera,
  Region,
  Color,
  ImageSeriesLayer,
} from "@";

const imageUrl =
  "https://files.cryoetdataportal.cziscience.com/10000/TS_041/Reconstructions/VoxelSpacing13.480/Tomograms/100/TS_041.zarr";
const labelsUrl =
  "https://files.cryoetdataportal.cziscience.com/10000/TS_041/Reconstructions/VoxelSpacing13.480/Annotations/114/membrane-1.0_segmentationmask.zarr";

const imageSource = new OmeZarrImageSource(imageUrl);
const labelsSource = new OmeZarrImageSource(labelsUrl);

const loader = await imageSource.open();
const attributes = await loader.loadAttributes();
const lods = attributes.length;
const attributesForLastLod = attributes[lods - 1];

const zDimName = "z";
const zAxisIndex = attributesForLastLod.dimensionNames.findIndex(
  (dim) => dim === zDimName
);
const zScale = attributesForLastLod.scale[zAxisIndex];
const zMin = 50 * zScale;
const zMax = 75 * zScale;

const zInterval = { start: zMin, stop: zMax };
const region: Region = [
  { dimension: zDimName, index: { type: "interval", ...zInterval } },
  { dimension: "x", index: { type: "full" } },
  { dimension: "y", index: { type: "full" } },
];

const imageLayer = new ImageSeriesLayer({
  source: imageSource,
  region,
  seriesDimensionName: zDimName,
  channelProps: [
    {
      visible: true,
      color: Color.WHITE,
      contrastLimits: [-10, 10],
    },
  ],
  lod: lods - 1,
});

const maskLayer = new ImageSeriesLayer({
  source: labelsSource,
  region,
  seriesDimensionName: zDimName,
  channelProps: [
    {
      visible: true,
      color: Color.RED,
      contrastLimits: [0, 1],
    },
  ],
  transparent: true,
  opacity: 0.5,
  blendMode: "normal",
  lod: lods - 1,
});

const layers = [imageLayer, maskLayer];

const slider = document.querySelector<HTMLInputElement>("#slider");
if (slider === null) throw new Error("Depth slider not found.");
slider.min = zMin.toString();
slider.max = (zMax - zScale).toString();
slider.step = zScale.toString();
slider.value = zMin.toString();

slider.addEventListener("input", (event) => {
  const value = (event.target as HTMLInputElement).valueAsNumber;
  for (const layer of layers) {
    layer.setPosition(value);
  }
});

for (const layer of layers) {
  layer.preloadSeries();
  layer.setPosition(slider.valueAsNumber);
}

const camera = new OrthographicCamera(0, 240 * zScale, 0, 232 * zScale);

new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("#canvas")!,
  camera,
  layers: layers,
}).start();
