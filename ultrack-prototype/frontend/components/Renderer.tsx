import { useEffect } from "react";
import {
  VideoLayer,
  LayerManager,
  OmeZarrImageSource,
  PerspectiveCamera,
  WebGLRenderer,
} from "@";
import { Box } from "@mui/material";

const canvasId = "canvas";

// Source is 5D, so provide indices at 3 dimensions to project to 2D.
const url =
  "https://public.czbiohub.org/royerlab/ultrack/multi-color/image.zarr/";
const source = new OmeZarrImageSource(url);
const timeInterval = { start: 100, stop: 150 };
const region = [
  // TODO: when the region is state associated with the renderer or
  // layer manager, and we have a reference to that, then sync it
  // with React state that captures the time-point.
  { dimension: "T", index: timeInterval },
  { dimension: "C", index: 0 },
  { dimension: "Z", index: 0 },
];
const layer = new VideoLayer(source, region, "T");
const layerManager = new LayerManager();
layerManager.add(layer);

interface RendererProps {
  curTime: number;
}

export default function Renderer(props: RendererProps) {
  const { curTime } = props;

  // Update region and reload when time changes.
  useEffect(() => {
    layer.setTimeIndex(curTime);
  }, [curTime]);

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
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        width: "100%",
        height: "100%",
      }}
    >
      <canvas id={canvasId} />
    </Box>
  );
}
