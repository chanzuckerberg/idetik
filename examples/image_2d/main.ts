import {
  ChannelProps,
  Idetik,
  ImageLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  SliceCoordinates,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";
import { ScaleBar } from "./scale_bar";
import { addDimensionSlider } from "../lil_gui_utils";
import {
  createExplorationPolicy,
  createPlaybackPolicy,
} from "@/core/image_source_policy";
import GUI from "lil-gui";

// A 2D OME-Zarr image viewer with a dataset selector. Pre-populated with three
// public datasets covering both Zarr v2 (OME-Zarr 0.4) and Zarr v3 (OME-Zarr
// 0.5), plus a custom-URL field. Selection persists across reloads via the URL
// hash.

type DatasetConfig = {
  id: string;
  label: string;
  url: string;
  /** Pass to OmeZarrImageSource.fromHttp; undefined => let the loader detect. */
  version?: "0.5";
  channel: number;
  contrastLimits: [number, number];
  channelColor?: string;
};

const PRESETS: DatasetConfig[] = [
  {
    id: "zebrahub",
    label: "Zebrahub (zarr v2)",
    url: "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/",
    channel: 0,
    contrastLimits: [0, 60],
  },
  {
    id: "gfp_ca_waves",
    label: "GFP Ca wave dynamics (zarr v3)",
    url: "https://uk1s3.embassy.ebi.ac.uk/ebi-ngff-challenge-2024/c0e5d621-62cc-43a6-9dad-2ddab8959d17.zarr",
    version: "0.5",
    channel: 1,
    contrastLimits: [409, 3000],
  },
  {
    id: "exaspim",
    label: "exaSPIM Fused (zarr v2, ~7.9M chunks)",
    url: "https://aind-open-data.s3.amazonaws.com/exaSPIM_822177_2026-04-24_17-36-07_processed_2026-05-04_09-30-27/fusion/fused.zarr/",
    channel: 0,
    contrastLimits: [0, 15],
    channelColor: "#00ffff",
  },
];

const CUSTOM_LABEL = "Custom URL...";

function parseHash(): {
  preset?: DatasetConfig;
  customUrl?: string;
} {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const datasetId = params.get("dataset");
  if (datasetId) {
    const preset = PRESETS.find((p) => p.id === datasetId);
    if (preset) return { preset };
  }
  const url = params.get("url");
  if (url) return { customUrl: url };
  return { preset: PRESETS[0] };
}

function setHashAndReload(hash: string) {
  window.location.hash = hash;
  window.location.reload();
}

const parsed = parseHash();
const config: DatasetConfig = parsed.preset ?? {
  id: "custom",
  label: "Custom",
  url: parsed.customUrl!,
  channel: 0,
  contrastLimits: [0, 65535],
};

const source = OmeZarrImageSource.fromHttp({
  url: config.url,
  version: config.version,
});

const datasetInfoDiv =
  document.querySelector<HTMLDivElement>("#dataset-info")!;
datasetInfoDiv.textContent = `Loading ${config.label}…\n${config.url}`;

const loader = await source.open();
const dimensions = loader.getSourceDimensionMap();
const zarrFormat = loader.omeZarrVersion === "0.5" ? "v3" : "v2";

const xLod = dimensions.x.lods[0];
const yLod = dimensions.y.lods[0];
const zLod = dimensions.z?.lods[0];
const tLod = dimensions.t?.lods[0];

const sliceCoords: SliceCoordinates = {
  c: [config.channel],
};
if (zLod) {
  sliceCoords.z = zLod.translation + 0.5 * zLod.size * zLod.scale;
}
if (tLod) {
  sliceCoords.t = tLod.translation;
}

const channelProps: ChannelProps[] = [
  {
    contrastLimits: config.contrastLimits,
    color: config.channelColor ?? "#ffffff",
  },
];

const imageLayer = new ImageLayer({
  source,
  sliceCoords,
  policy: createExplorationPolicy(),
  channelProps,
});

const camera = new OrthographicCamera(
  xLod.translation,
  xLod.translation + xLod.scale * xLod.size,
  yLod.translation,
  yLod.translation + yLod.scale * yLod.size
);

const timePointDiv = document.querySelector<HTMLDivElement>("#time-point")!;
if (!tLod) timePointDiv.style.display = "none";
const timePointOverlay = {
  update() {
    const time = imageLayer.lastPresentationTimeCoord;
    timePointDiv.textContent =
      time === undefined ? "" : `t = ${time}`;
  },
};

const scaleBar = new ScaleBar({
  textDiv: document.querySelector<HTMLDivElement>("#scale-bar-text")!,
  lineDiv: document.querySelector<HTMLDivElement>("#scale-bar-line")!,
  unit: dimensions.x.unit ?? "",

});

const idetik = new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("#canvas")!,
  viewports: [
    {
      camera,
      cameraControls: new PanZoomControls(camera),
      layers: [imageLayer],
    },
  ],
  overlays: [timePointOverlay, scaleBar],
  showStats: true,
}).start();

datasetInfoDiv.innerHTML = formatDatasetInfo(config, dimensions, zarrFormat);

// --- GUI ---------------------------------------------------------------

const gui = new GUI({ width: 380 });

// Dataset selector
const datasetFolder = gui.addFolder("Dataset");
const datasetState = {
  selection: parsed.preset?.label ?? CUSTOM_LABEL,
  customUrl: parsed.customUrl ?? "",
};
const allLabels = [...PRESETS.map((p) => p.label), CUSTOM_LABEL];
datasetFolder
  .add(datasetState, "selection", allLabels)
  .name("Dataset")
  .onChange((label: string) => {
    if (label === CUSTOM_LABEL) {
      // Stay put; user enters URL below and clicks Load.
      return;
    }
    const preset = PRESETS.find((p) => p.label === label);
    if (preset) setHashAndReload(`#dataset=${preset.id}`);
  });
datasetFolder.add(datasetState, "customUrl").name("Custom URL");
datasetFolder
  .add(
    {
      load: () => {
        const url = datasetState.customUrl.trim();
        if (!url) return;
        setHashAndReload(`#url=${encodeURIComponent(url)}`);
      },
    },
    "load"
  )
  .name("Load custom URL");

// Slice (t, z) sliders -- only show if the dataset has those dims.
if (zLod && zLod.size > 1) {
  addDimensionSlider({
    gui,
    sliceCoords,
    dimensionName: "z",
    minValue: zLod.translation,
    maxValue: zLod.translation + (zLod.size - 1) * zLod.scale,
    stepValue: zLod.scale,
    playback: {},
  });
}
if (tLod && tLod.size > 1) {
  addDimensionSlider({
    gui,
    sliceCoords,
    dimensionName: "t",
    minValue: tLod.translation,
    maxValue: tLod.translation + (tLod.size - 1) * tLod.scale,
    stepValue: tLod.scale,
    playback: {
      onRateChange: (rateHz: number) => {
        imageLayer.imageSourcePolicy =
          rateHz > 0 ? createPlaybackPolicy() : createExplorationPolicy();
      },
    },
  });
}

// Channel
const channelFolder = gui.addFolder("Channel");
const channelState = {
  contrastMin: config.contrastLimits[0],
  contrastMax: config.contrastLimits[1],
  color: config.channelColor ?? "#ffffff",
};
channelFolder
  .add(channelState, "contrastMin")
  .name("Contrast min")
  .onChange(updateChannel);
channelFolder
  .add(channelState, "contrastMax")
  .name("Contrast max")
  .onChange(updateChannel);
channelFolder
  .addColor(channelState, "color")
  .name("Color")
  .onChange(updateChannel);

function updateChannel() {
  if (channelState.contrastMin >= channelState.contrastMax) return;
  imageLayer.setChannelProps([
    {
      contrastLimits: [channelState.contrastMin, channelState.contrastMax],
      color: channelState.color,
    },
  ]);
}

// Debug
const debugFolder = gui.addFolder("Debug");
const debugState = { showWireframes: imageLayer.debugMode };
debugFolder
  .add(debugState, "showWireframes")
  .name("Show tile wireframes")
  .onChange((show: boolean) => (imageLayer.debugMode = show));

void idetik;

// --- helpers -----------------------------------------------------------

function formatDatasetInfo(
  cfg: DatasetConfig,
  dims: ReturnType<typeof loader.getSourceDimensionMap>,
  format: "v2" | "v3"
): string {
  const xL = dims.x.lods[0];
  const yL = dims.y.lods[0];
  const zL = dims.z?.lods[0];
  const tL = dims.t?.lods[0];
  const cL = dims.c?.lods[0];
  const shape = [tL?.size, cL?.size, zL?.size, yL.size, xL.size]
    .filter((v) => v !== undefined)
    .join(" × ");
  const scale = [zL?.scale, yL.scale, xL.scale]
    .filter((v) => v !== undefined)
    .map((v) => v!.toPrecision(3))
    .join(" × ");
  const unit = dims.x.unit ?? "";
  const escapedLabel = cfg.label
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return [
    `<div class="label">${escapedLabel}</div>`,
    `<div class="meta">`,
    `format: zarr ${format} (OME-Zarr ${loader.omeZarrVersion})`,
    `shape:  ${shape}  ${labelAxes(dims)}`,
    `LODs:   ${dims.numLods}`,
    `voxel:  ${scale}${unit ? " " + unit : ""}`,
    `</div>`,
  ].join("\n");
}

function labelAxes(dims: ReturnType<typeof loader.getSourceDimensionMap>) {
  const axes: string[] = [];
  if (dims.t) axes.push("T");
  if (dims.c) axes.push("C");
  if (dims.z) axes.push("Z");
  axes.push("Y");
  axes.push("X");
  return `(${axes.join(" × ")})`;
}
