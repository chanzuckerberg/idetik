import { useEffect, useRef } from "react";
import {
  LayerManager,
  PerspectiveCamera,
  WebGLRenderer,
} from "viz";
import { Box } from "@mui/material";

const canvasId = "canvas";

interface RendererProps {
    initLayerManager: LayerManager;
}

export default function Renderer(props: RendererProps) {
  // This is a silly workaround to ensure the mount effect below
  // does not depend on something that could be React state.
  const layerManagerRef = useRef<LayerManager>(props.initLayerManager);

  // Use the mount-effect so that the renderer can find the corresponding
  // element by its ID.
  useEffect(() => {
      let lastRequestId = 0;
      const renderer = new WebGLRenderer(`#${canvasId}`);
      const camera = new PerspectiveCamera(60, renderer.width / renderer.height);
      function animate() {
          renderer.render(layerManagerRef.current, camera);
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
