import {
  Idetik,
  ImageLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  Region,
  ViewportConfig,
} from "@";
import { AxesLayer } from "@/layers/axes_layer";
import { PanZoomControls } from "@/objects/cameras/controls";

const url =
  "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/";

// Source is 5D, so provide indices at 3 dimensions to project to 2D.
const source = new OmeZarrImageSource(url);
const regions = {
  A: [
    { dimension: "t", index: { type: "point", value: 400 } },
    { dimension: "c", index: { type: "point", value: 0 } },
    { dimension: "z", index: { type: "point", value: 300 } },
    { dimension: "y", index: { type: "full" } },
    { dimension: "x", index: { type: "full" } },
  ] as Region,
  B: [
    { dimension: "t", index: { type: "point", value: 200 } }, // Different time point
    { dimension: "c", index: { type: "point", value: 0 } },
    { dimension: "z", index: { type: "point", value: 300 } },
    { dimension: "y", index: { type: "full" } },
    { dimension: "x", index: { type: "full" } },
  ] as Region,
  C: [
    { dimension: "t", index: { type: "point", value: 400 } },
    { dimension: "c", index: { type: "point", value: 0 } },
    { dimension: "z", index: { type: "point", value: 150 } }, // Different Z slice
    { dimension: "y", index: { type: "full" } },
    { dimension: "x", index: { type: "full" } },
  ] as Region,
  D: [
    { dimension: "t", index: { type: "point", value: 400 } },
    { dimension: "c", index: { type: "point", value: 0 } },
    { dimension: "z", index: { type: "point", value: 250 } }, // Different Z slice
    { dimension: "y", index: { type: "full" } },
    { dimension: "x", index: { type: "full" } },
  ] as Region,
};

const channelProps = [{ contrastLimits: [0, 255] as [number, number] }];

const canvas = document.querySelector<HTMLCanvasElement>("canvas")!;
const viewportA = document.querySelector<HTMLElement>('[data-view-id="A"]')!;
const viewportB = document.querySelector<HTMLElement>('[data-view-id="B"]')!;
const viewportC = document.querySelector<HTMLElement>('[data-view-id="C"]')!;
const viewportD = document.querySelector<HTMLElement>('[data-view-id="D"]')!;

const baseLeft = 150;
const baseRight = 950;
const baseTop = 100;
const baseBottom = 900;
const cameraA = new OrthographicCamera(
  baseLeft,
  baseRight,
  baseTop,
  baseBottom
);
const cameraB = new OrthographicCamera(
  baseLeft,
  baseRight,
  baseTop,
  baseBottom
);

const viewports: ViewportConfig[] = [
  {
    id: "A",
    element: viewportA,
    camera: cameraA,
    layers: [
      new ImageLayer({ source, region: regions.A, channelProps }),
      new AxesLayer({ length: 200, width: 0.01 }),
    ],
    cameraControls: new PanZoomControls(cameraA),
  },
  {
    id: "B",
    element: viewportB,
    camera: cameraB,
    layers: [new ImageLayer({ source, region: regions.B, channelProps })],
    cameraControls: new PanZoomControls(cameraB),
  },
  {
    id: "C",
    element: viewportC,
    camera: new OrthographicCamera(baseLeft, baseRight, baseTop, baseBottom),
    layers: [new ImageLayer({ source, region: regions.C, channelProps })],
    cameraControls: undefined,
  },
  {
    id: "D",
    element: viewportD,
    camera: new OrthographicCamera(baseLeft, baseRight, baseTop, baseBottom),
    layers: [new ImageLayer({ source, region: regions.D, channelProps })],
    cameraControls: undefined,
  },
];

// Enable debug mode for the first viewport's first image layer
const firstViewport: ViewportConfig = viewports[0]!;
if (firstViewport.layers && firstViewport.layers.length > 0) {
  const firstImageLayer = firstViewport.layers[0] as ImageLayer;
  firstImageLayer.debugMode = true;
}

new Idetik({
  canvas,
  viewports,
  showStats: true,
}).start();
