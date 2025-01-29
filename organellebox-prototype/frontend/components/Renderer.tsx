import { useEffect } from "react";
import {
  // ImageLayer,
  LayerManager,
  OrthographicCamera,
  WebGLRenderer,
} from "@";

import { Box } from "@mui/material";
import { NullControls, PanZoomControls } from "@/objects/cameras/controls";

const canvasId = "canvas";

// TODO: consider useRef for these objects
const camera = new OrthographicCamera(0, 1920, 0, 1440);
const controls = new PanZoomControls(camera, camera.position);
const layerManager = new LayerManager();
// const imageLayer = new ImageLayer(source, region);
// layerManager.addLayer(imageLayer);

export default function Renderer() {
  // Use the mount-effect so that the renderer can find the corresponding
  // element by its ID.
  useEffect(() => {
    console.debug("Renderer::mount");
    let lastRequestId = 0;
    const renderer = new WebGLRenderer(`#${canvasId}`);
    renderer.setControls(controls);
    function animate() {
      renderer.render(layerManager, camera);
      lastRequestId = requestAnimationFrame(animate);
    }
    animate();
    return () => {
      // TODO: cleanup by disposing objects owned by the renderer and camera.
      renderer.setControls(new NullControls());
      if (lastRequestId > 0) {
        console.debug(`Cancelling animation frame ${lastRequestId}`);
        cancelAnimationFrame(lastRequestId);
      }
    };
  }, []);

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <canvas id={canvasId} style={{ width: "100%", height: "100%" }} />
    </Box>
  );
}
