import { vec3 } from "gl-matrix";
import {
  GaussianSplatLayer,
  Idetik,
  OrbitControls,
  PerspectiveCamera,
} from "@";

// Cluster fly by Dany Bittel (https://www.danybittel.ch), licensed CC BY 4.0
// (https://creativecommons.org/licenses/by/4.0/). Originally published at
// https://github.com/danybittel/splats; this is the smallest of its sizes, as
// hosted in the vispy demo data.
const url =
  "https://raw.githubusercontent.com/vispy/demo-data/main/gaussian_splatting/cluster/cluster_fly_S.ply";

const layer = await GaussianSplatLayer.fromPly(url);

const { min, max } = layer.bounds;
const center = vec3.lerp(vec3.create(), min, max, 0.5);
const diagonal = vec3.distance(min, max);

const camera = new PerspectiveCamera({
  near: diagonal * 0.001,
  far: diagonal * 100,
});

const idetik = new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("#canvas")!,
  viewports: [
    {
      camera,
      cameraControls: new OrbitControls(camera, {
        radius: diagonal * 1.5,
        target: center,
      }),
      layers: [layer],
    },
  ],
  showStats: true,
});
idetik.start();

document.querySelector("#splat-count")!.textContent =
  `${layer.splatCount.toLocaleString()} splats`;
