import { Dispatch, SetStateAction, useEffect } from "react";
import {
  ImageSeriesLayer,
  LayerManager,
  OmeZarrImageSource,
  OrthographicCamera,
  WebGLRenderer,
} from "@";
import { Box } from "@mui/material";

import { imageSeriesProps } from "../image_series_props";

const canvasId = "canvas";

const layer = new ImageSeriesLayer(
  new OmeZarrImageSource(imageSeriesProps.url),
  imageSeriesProps.region,
  imageSeriesProps.timeDimension
);
const layerManager = new LayerManager();
layerManager.add(layer);

type RendererProps = {
  playbackEnabled: boolean;
  setPlaybackEnabled: Dispatch<SetStateAction<boolean>>;
  curTime: number;
};

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
    const camera = new OrthographicCamera(0, 1920, 0, 1440);
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
    // https://github.com/chanzuckerberg/imaging-active-learning/issues/77
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
