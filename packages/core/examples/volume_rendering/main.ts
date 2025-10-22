import { Idetik, VolumeLayer, PerspectiveCamera } from "@";
import { OrbitControls } from "@/objects/cameras/orbit_controls";

const camera = new PerspectiveCamera();

new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("#canvas")!,
  viewports: [
    {
      camera,
      cameraControls: new OrbitControls(camera, { radius: 3 }),
      layers: [new VolumeLayer()],
    },
  ],
  showStats: true,
}).start();
