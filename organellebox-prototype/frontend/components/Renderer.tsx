import { useEffect } from "react";
import {
  ImageLayer,
  OmeZarrImageSource,
  LayerManager,
  OrthographicCamera,
  WebGLRenderer,
} from "@";

import {
  loadOmeZarrPlate,
  loadOmeZarrWell,
} from "@/data/ome_zarr_hcs_metadata_loader";

const canvasId = "canvas";

// TODO: useRef for some of these objects
const camera = new OrthographicCamera(0, 1920, 0, 1440);
const layerManager = new LayerManager();

// TODO: use props to pass in most of this config
const plateUrl =
  "http://localhost:8000/20200812-CardiomyocyteDifferentiation14-Cycle1_mip.zarr";
const plate = await loadOmeZarrPlate(plateUrl);
const wellPaths = plate.plate?.wells.map((well) => well.path);
if (!wellPaths) {
  throw new Error("No wells found in plate");
}
const well = await loadOmeZarrWell(plateUrl, wellPaths[0]);
const imagePaths = well.well?.images.map((image) => image.path);
if (!imagePaths) {
  throw new Error("No images found in well");
}
const imageUrl = plateUrl + "/" + wellPaths[0] + "/" + imagePaths[0];
const source = new OmeZarrImageSource(imageUrl);
const region = [
  { dimension: "c", index: 0 },
  { dimension: "z", index: 0 },
];
const layer = new ImageLayer(source, region);
layerManager.add(layer);


export default function Renderer() {
  // Use the mount-effect so that the renderer can find the corresponding
  // element by its ID.
  useEffect(() => {
    console.debug("Renderer::mount");
    let lastRequestId = 0;
    const renderer = new WebGLRenderer(`#${canvasId}`);
    function animate() {
      renderer.render(layerManager, camera);
      lastRequestId = requestAnimationFrame(animate);
    }
    animate();
    return () => {
      // TODO: cleanup by disposing objects owned by the renderer and camera.
      if (lastRequestId > 0) {
        console.debug(`Cancelling animation frame ${lastRequestId}`);
        cancelAnimationFrame(lastRequestId);
      }
    };
  }, []);

  return (
    <canvas id={canvasId} style={{ width: "100%", height: "100%" }} />
  );
}
