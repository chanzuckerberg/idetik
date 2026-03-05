import { vec3 } from "gl-matrix";
import GUI from "lil-gui";
import { Idetik, OmeZarrImageSource, PerspectiveCamera, VolumeLayer } from "@";
import { createExplorationPolicy } from "@/core/image_source_policy";
import { OrbitControls } from "@/objects/cameras/orbit_controls";

const url =
  "https://public.czbiohub.org/organelle_box/datasets/A549/organelle_box_crop_v1.zarr/CLTA/PFA/002000/";
const source = OmeZarrImageSource.fromHttp({ url });
const sliceCoords = {
  t: 0,
  z: undefined,
  c: undefined, // Show all channels
};
const controls = { lod: 2 };

const camera = new PerspectiveCamera();
const policy = createExplorationPolicy({
  lod: { min: controls.lod, max: controls.lod },
});
const channelVisibility = {
  "Channel 0": false,
  "Channel 1": true,
  "Channel 2": true,
};
const volumeLayer = new VolumeLayer({
  source,
  sliceCoords,
  policy,
  channelProps: [
    {
      visible: channelVisibility["Channel 0"],
      color: [1, 1, 1],
      contrastLimits: [-1.5, 10.0],
    },
    {
      visible: channelVisibility["Channel 1"],
      color: [0, 0, 1],
      contrastLimits: [108, 353],
    },
    {
      visible: channelVisibility["Channel 2"],
      color: [0, 1, 0],
      contrastLimits: [144, 3825],
    },
  ],
});
const idetik = new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("#canvas")!,
  viewports: [
    {
      camera,
      cameraControls: new OrbitControls(camera, {
        radius: 100,
        target: vec3.fromValues(40, 40, 10), // Volume center,
      }),
      layers: [volumeLayer],
    },
  ],
  showStats: true,
});

idetik.start();

// Add GUI controls to manipulate rendering
const gui = new GUI({ width: 500 });
gui
  .add(controls, "lod", 0, 2, 1)
  .name("Level of Detail (LOD)")
  .onChange(
    (lod: number) =>
      (volumeLayer.sourcePolicy = createExplorationPolicy({
        lod: { min: lod, max: lod },
      }))
  );

const volumeFolder = gui.addFolder("Volume Rendering");
volumeFolder
  .add(volumeLayer, "relativeStepSize", 0.25, 3.0, 0.1)
  .name("Relative step size (voxels)");

// maps 0-1 slider to [0.001, 10.0] logarithmically
const opacityControls = {
  get opacity() {
    return (Math.log10(volumeLayer.opacityMultiplier) + 3) / 4;
  },
  set opacity(sliderValue: number) {
    volumeLayer.opacityMultiplier = Math.pow(10, sliderValue * 4 - 3);
  },
};
volumeFolder
  .add(opacityControls, "opacity", 0, 1, 0.01)
  .name("Opacity")
  .decimals(2);
volumeFolder
  .add(volumeLayer, "earlyTerminationAlpha", 0.8, 1.0, 0.01)
  .name("Early termination threshold");

function updateChannelProps() {
  const props = volumeLayer.channelProps;
  if (!props) return;
  const updated = props.map((p, i) => ({
    ...p,
    visible: Object.values(channelVisibility)[i],
  }));
  volumeLayer.setChannelProps(updated);
}

const channelsFolder = gui.addFolder("Channels");
channelsFolder.add(channelVisibility, "Channel 0").onChange(updateChannelProps);
channelsFolder.add(channelVisibility, "Channel 1").onChange(updateChannelProps);
channelsFolder.add(channelVisibility, "Channel 2").onChange(updateChannelProps);

const overlaysFolder = gui.addFolder("Debug");
overlaysFolder
  .add(volumeLayer, "debugShowWireframes")
  .name("Show tile wireframes");
overlaysFolder
  .add(volumeLayer, "debugShowDegenerateRays")
  .name("Show degenerate rays (length 0)");
