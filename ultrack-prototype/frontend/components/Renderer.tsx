import { useEffect } from "react";
import {
  ImageLayer,
  LayerManager,
  OmeZarrImageSource,
  PerspectiveCamera,
  WebGLRenderer,
} from "@";
import { Box } from "@mui/material";

const canvasId = "canvas";

// Source is 5D, so provide indices at 3 dimensions to project to 2D.
const url = "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/";
const source = new OmeZarrImageSource(url);
const region = [
  // TODO: when the region is state associated with the renderer or
  // layer manager, and we have a reference to that, then sync it
  // with React state that captures the time-point.
  { dimension: "t", index: 400 },
  { dimension: "c", index: 0 },
  { dimension: "z", index: 300 },
];
const layer = new ImageLayer(source, region);
const layerManager = new LayerManager();
layerManager.add(layer);

export default function Renderer() {
  // Use the mount-effect so that the renderer can find the corresponding
  // element by its ID.
  useEffect(() => {
    let lastRequestId = 0;
    const renderer = new WebGLRenderer(`#${canvasId}`);
    const camera = new PerspectiveCamera(60, renderer.width / renderer.height);
    function animate() {
        renderer.render(layerManager, camera);
        lastRequestId = requestAnimationFrame(animate);
    }
    animate();
    return () => {
      // TODO: cleanup by disposing objects owned by the renderer and camera.
      if (lastRequestId > 0) {
        console.log(`Cancelling animation frame ${lastRequestId}`);
        cancelAnimationFrame(lastRequestId);
      }
    };
  }, []);

  return (
    <Box sx={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        width: "100%",
        height: "100%",
    }}>
      <canvas id={canvasId}/>
    </Box>
  );
}
