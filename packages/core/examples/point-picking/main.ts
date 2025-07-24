import {
  Idetik,
  ImageLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  Region,
} from "@";
import { AxesLayer } from "@/layers/axes_layer";
import { PickingControls } from "@/objects/cameras/picking_controls";

const url =
  "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/";
const left = 150;
const right = 950;
const top = 100;
const bottom = 900;

// Source is 5D, so provide indices at 3 dimensions to project to 2D.
// Also specify a subregion in x and y to exercise that part of the API.
const source = new OmeZarrImageSource(url);
const region: Region = [
  { dimension: "t", index: { type: "point", value: 400 } },
  { dimension: "c", index: { type: "point", value: 0 } },
  { dimension: "z", index: { type: "point", value: 300 } },
  { dimension: "y", index: { type: "interval", start: top, stop: bottom } },
  { dimension: "x", index: { type: "interval", start: left, stop: right } },
];
const channelProps = [{ contrastLimits: [0, 255] as [number, number] }];
const layer = new ImageLayer({ source, region, channelProps });
const axes = new AxesLayer({ length: 2000, width: 0.01 });
const camera = new OrthographicCamera(left, right, top, bottom);
const canvas = document.querySelector<HTMLCanvasElement>("canvas")!;

// Get the info div for displaying pick results
const pickInfoDiv = document.querySelector<HTMLDivElement>("#pick-info")!;

// Create Idetik instance first to get layer manager
const idetik = new Idetik({
  canvas,
  camera,
  layers: [layer, axes],
});

// Create picking controls with proper layer manager reference
const pickingControls = new PickingControls(
  camera,
  canvas,
  idetik.layerManager,
  // Callback for when a segment is picked
  (info) => {
    const { client, world, segmentId, layer } = info;
    pickInfoDiv.innerHTML = `
      <strong>Pick Result:</strong><br/>
      Client: (${client[0].toFixed(1)}, ${client[1].toFixed(1)})<br/>
      World: (${world[0].toFixed(1)}, ${world[1].toFixed(1)}, ${world[2].toFixed(1)})<br/>
      Segment ID: ${segmentId ?? "null"}<br/>
      Layer: ${layer?.type ?? "none"}
    `;
  }
);

// Set the controls after creating the idetik instance
idetik.setControls(pickingControls);

idetik.start();