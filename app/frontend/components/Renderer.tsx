import { useEffect } from "react";
import {
  LayerManager,
  PerspectiveCamera,
  WebGLRenderer,
} from "@";
import { Box } from "@mui/material";

const canvasId = "canvas";

interface RendererProps {
    layerManager: LayerManager;
}

export default function Renderer(props: RendererProps) {
  // Use the mount-effect so that the renderer can find the corresponding
  // element by its ID.
  useEffect(() => {
      let lastRequestId = 0;
      const renderer = new WebGLRenderer(`#${canvasId}`);
      const camera = new PerspectiveCamera(60, renderer.width / renderer.height);
      function animate() {
          renderer.render(props.layerManager, camera);
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
