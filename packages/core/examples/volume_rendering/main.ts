import { Idetik, VolumeLayer, PerspectiveCamera, OmeZarrImageSource } from "@";
import { OrbitControls } from "@/objects/cameras/orbit_controls";
import { createExplorationPolicy } from "@/core/image_source_policy";

const url =
  "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/";
const source = new OmeZarrImageSource(url);

// TODO (SKM): the z makes not really much sense in this context, but keeping for
// now to keep consistent with other examples
const sliceCoords = {
  t: 400,
  z: 300,
  c: 0,
};

const camera = new PerspectiveCamera();

new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("#canvas")!,
  viewports: [
    {
      camera,
      cameraControls: new OrbitControls(camera, { radius: 3 }),
      layers: [new VolumeLayer({ source, sliceCoords, policy: createExplorationPolicy() })],
    },
  ],
  showStats: true,
}).start();
