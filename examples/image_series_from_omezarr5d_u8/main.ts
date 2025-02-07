import {
  LayerManager,
  LayerState,
  ImageSeriesLayer,
  OrthographicCamera,
  WebGLRenderer,
  OmeZarrImageSource,
} from "@";

const url =
  "https://public.czbiohub.org/royerlab/ultrack/multi-color/image.zarr/";
const layerManager = new LayerManager();
const renderer = new WebGLRenderer("#canvas");
const camera = new OrthographicCamera(0, 1920, 0, 1440);

// Track channel states
const channelStates = {
  r: true,
  g: true,
  b: true
};

// Add event listeners for channel toggles
const channelR = document.getElementById('channel-r') as HTMLInputElement;
const channelG = document.getElementById('channel-g') as HTMLInputElement;
const channelB = document.getElementById('channel-b') as HTMLInputElement;

function updateChannels() {
  console.debug('Updating channel states');
  console.debug('channelR.checked', channelR.checked);
  console.debug('channelG.checked', channelG.checked);
  console.debug('channelB.checked', channelB.checked);
  channelStates.r = channelR.checked;
  channelStates.g = channelG.checked;
  channelStates.b = channelB.checked;

  console.debug('Channel states updated:', channelStates);
  // We'll need to update the layer/material here
  // layer.setChannelStates([channelStates.r, channelStates.g, channelStates.b]);
}

channelR.addEventListener('change', updateChannels);
channelG.addEventListener('change', updateChannels);
channelB.addEventListener('change', updateChannels);

// Source is 5D, so provide an interval in T and C (all three channels)
// and scalar indices in Z (first of only depth) to get a 2D image series.
const source = new OmeZarrImageSource(url);
const timeInterval = { start: 100, stop: 120 };
const channels = { start: 0, stop: 3 };
const region = [
  { dimension: "T", index: timeInterval },
  { dimension: "C", index: channels },
  { dimension: "Z", index: 0 },
];
const layer = new ImageSeriesLayer(source, region, "T");
layerManager.add(layer);

const slider = document.querySelector<HTMLInputElement>("#slider");
if (slider === null) throw new Error("Time slider not found.");
slider.min = timeInterval.start.toString();
slider.max = (timeInterval.stop - 1).toString();

layer.addStateChangeCallback((newState: LayerState) => {
  if (newState === "ready") {
    slider.addEventListener("input", (event) => {
      const value = (event.target as HTMLInputElement).valueAsNumber;
      layer.setTimeIndex(value);
    });
    layer.setTimeIndex(slider.valueAsNumber);
  }
});

function animate() {
  renderer.render(layerManager, camera);
  requestAnimationFrame(animate);
}

animate();
