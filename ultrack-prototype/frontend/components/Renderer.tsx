import { Dispatch, SetStateAction, useEffect } from "react";
import {
  VideoLayer,
  LayerManager,
  OmeZarrImageSource,
  PerspectiveCamera,
  WebGLRenderer,
} from "@";
import { Box } from "@mui/material";

import { videoLayerProps } from "../video_layer_props";

const canvasId = "canvas";

const layer = new VideoLayer(
  new OmeZarrImageSource(videoLayerProps.url),
  videoLayerProps.region,
  videoLayerProps.timeDimension
);
const layerManager = new LayerManager();
layerManager.add(layer);

interface RendererProps {
  playbackEnabled: boolean;
  setPlaybackEnabled: Dispatch<SetStateAction<boolean>>;
  curTime: number;
}

export default function Renderer(props: RendererProps) {
  const { playbackEnabled, setPlaybackEnabled, curTime } = props;

  useEffect(() => {
    console.debug("Renderer::useEffect::curTime: ", curTime);
    if (playbackEnabled) {
      layer.setTimeIndex(curTime);
    }
  }, [curTime, playbackEnabled]);

  // Use the mount-effect so that the renderer can find the corresponding
  // element by its ID.
  useEffect(() => {
    console.debug("Renderer::mount");
    let lastRequestId = 0;
    const renderer = new WebGLRenderer(`#${canvasId}`);
    // TODO: use an Orthographic camera.
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

  useEffect(() => {
    // TODO: need to remove observer as part of dismount function.
    layer.onStateChange((newState) => setPlaybackEnabled(newState === "ready"));
  }, [setPlaybackEnabled]);

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
