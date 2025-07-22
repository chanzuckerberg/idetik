import {
  Idetik,
  OmeZarrImageSource,
  OrthographicCamera,
  Region,
  Color,
  ImageLayer,
  LabelImageLayer,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";

// These roughly correspond in terms of content and the number of time-points.
// But the image is smaller in XY than the labels, and has a Z-stack, so it
// is unclear which Z-slice the labels correspond to (if any particular one)
const baseUrl =
  "https://public.czbiohub.org/organelle_box/datasets/A549/2024_11_07_A549_SEC61_DENV";
const imageUrl = `${baseUrl}_cropped.zarr/B/3/000000`;
const labelsUrl = `${baseUrl}_tracking.zarr/B/3/000000`;

const imageSource = new OmeZarrImageSource(imageUrl);
const labelsSource = new OmeZarrImageSource(labelsUrl);

const imageRegion: Region = [
  { dimension: "T", index: { type: "point", value: 0 } },
  // Chunk manager does not support multi-channel images?
  { dimension: "C", index: { type: "point", value: 0 } },
  // Mid-slice in Z.
  { dimension: "Z", index: { type: "point", value: 0.1494 * 4 } },
  { dimension: "Y", index: { type: "full" } },
  { dimension: "X", index: { type: "full" } },
];

const imageLayer = new ImageLayer({
  source: imageSource,
  region: imageRegion,
  transparent: true,
  channelProps: [
    {
      visible: true,
      // Phase with contrast limits chosen somewhat arbitrarily.
      color: Color.WHITE,
      contrastLimits: [0, 200],
    },
  ],
  lod: 0,
});

const labelsRegion: Region = [
  { dimension: "T", index: { type: "point", value: 0 } },
  { dimension: "C", index: { type: "point", value: 0 } },
  { dimension: "Z", index: { type: "point", value: 0 } },
  { dimension: "Y", index: { type: "full" } },
  { dimension: "X", index: { type: "full" } },
];

const labelsLayer = new LabelImageLayer({
  source: labelsSource,
  region: labelsRegion,
  transparent: true,
  opacity: 0.25,
  blendMode: "normal",
  lod: 0,
});

const camera = new OrthographicCamera(0, 128, 0, 128);
new Idetik({
  canvasSelector: "canvas",
  camera,
  layers: [imageLayer, labelsLayer],
  controls: new PanZoomControls(camera, camera.position),
}).start();
