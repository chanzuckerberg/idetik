import { useEffect } from "react";
import {
  ImageLayer,
  OmeZarrImageSource,
  LayerManager,
  OrthographicCamera,
  PanZoomControls,
  WebGLRenderer,
  //loadOmeZarrPlate,
  //loadOmeZarrWell,
} from "@idetik/core";

// TODO: needs to be unique so we can have more than one on the page
const canvasId = "canvas";

// TODO: useRef for some of these objects
const camera = new OrthographicCamera(0, 825, 0, 500);
const layerManager = new LayerManager();

// TODO: use props to pass in most of this config
const plateUrl =
  "http://localhost:8080/20200812-CardiomyocyteDifferentiation14-Cycle1_mip.zarr";
// const plate = await loadOmeZarrPlate(plateUrl);
// //@ts-expect-error TODO: export more types?
// const wellPaths = plate.plate?.wells.map((well) => well.path);
// if (!wellPaths) {
//   throw new Error("No wells found in plate");
// }
// const well = await loadOmeZarrWell(plateUrl, wellPaths[0]);
// //@ts-expect-error TODO: export more types?
// const imagePaths = well.well?.images.map((image) => image.path);
// if (!imagePaths) {
//   throw new Error("No images found in well");
// }
// const imageUrl = plateUrl + "/" + wellPaths[0] + "/" + imagePaths[0];
const imageUrl = plateUrl + "/B/03/0";
console.debug(`Loading image from ${imageUrl}`);
const source = new OmeZarrImageSource(imageUrl);
const region = [
  { dimension: "c", index: { start: 0, stop: 3 } },
  { dimension: "z", index: 0 },
];

// colors and limits come from the OME-Zarr metadata
// http://localhost:8080/20200812-CardiomyocyteDifferentiation14-Cycle1_mip.zarr/B/03/0/.zattrs
// ...but they look bad? especially the third channel is very bright and yellow
const channelProps = [
  { color: [0, 1, 1], contrastLimits: [0, 800] },
  { color: [1, 0, 1], contrastLimits: [0, 250] },
  { color: [1, 1, 0], contrastLimits: [0, 800], visible: false },
];
// TODO: why does TypeScript allow the wrong args here?
// const layer = new ImageLayer(123);
const layer = new ImageLayer({ source, region, channelProps });
layerManager.add(layer);

export default function Renderer() {
  // Use the mount-effect so that the renderer can find the corresponding
  // element by its ID.
  useEffect(() => {
    console.debug("Renderer::mount");
    let lastRequestId = 0;
    const renderer = new WebGLRenderer(`#${canvasId}`);
    const controls = new PanZoomControls(camera, camera.position);
    renderer.setControls(controls);
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

  return <canvas id={canvasId} style={{ width: "100%", height: "100%" }} />;
}
