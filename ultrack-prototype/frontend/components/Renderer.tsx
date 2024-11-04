import { Dispatch, SetStateAction, useEffect, useState } from "react";
import {
  ImageSeriesLayer,
  LayerManager,
  LayerState,
  OmeZarrImageSource,
  OrthographicCamera,
  WebGLRenderer,
} from "@";

import { imageUrl } from "../lib/mock_data";
import { Task } from "../lib/tasks";
import { Box } from "@mui/material";
import { LoadingIndicator } from "@czi-sds/components";

const canvasId = "canvas";

// TODO: consider useRef for these objects
const imageSource = new OmeZarrImageSource(imageUrl);
let camera = new OrthographicCamera(0, 1920, 0, 1440);
const layerManager = new LayerManager();

type RendererProps = {
  curTime: number;
  playbackEnabled: boolean;
  setPlaybackEnabled: Dispatch<SetStateAction<boolean>>;
  task: Task | null;
};

export default function Renderer(props: RendererProps) {
  const { curTime, playbackEnabled, setPlaybackEnabled, task } = props;
  const [imageSeriesLayer, setImageSeriesLayer] =
    useState<ImageSeriesLayer | null>(null);

  useEffect(() => {
    console.debug("Renderer::useEffect::curTime: ", curTime);
    if (imageSeriesLayer === null) return;
    if (imageSeriesLayer.state === "ready") {
      imageSeriesLayer.setTimeIndex(curTime);
      return;
    }
    const onStateChange = (newState: LayerState) => {
      if (newState === "ready") {
        imageSeriesLayer.setTimeIndex(curTime);
      }
    };
    imageSeriesLayer.addStateChangeCallback(onStateChange);
    return () => imageSeriesLayer.removeStateChangeCallback(onStateChange);
  }, [curTime, imageSeriesLayer]);

  useEffect(() => {
    console.debug("Renderer::useEffect::task: ", task);
    setPlaybackEnabled(false);
    if (!task) {
      return;
    }
    const { tracksLayer, imageSeriesLayer } = task.layers(imageSource);
    imageSeriesLayer.update();
    setImageSeriesLayer(imageSeriesLayer);
    const onStateChange = (newState: LayerState) => {
      if (newState === "ready") {
        setPlaybackEnabled(true);
        // TODO: update the data on the layers instead of creating new ones
        layerManager.layers.length = 0;
        layerManager.add(tracksLayer);
        layerManager.add(imageSeriesLayer);
        // TODO: update the camera in-place instead of creating a new one
        // (this will make zoom/pan callbacks easier to manage)
        camera = task.camera(2.0);
      }
    };
    imageSeriesLayer.addStateChangeCallback(onStateChange);
    return () => imageSeriesLayer.removeStateChangeCallback(onStateChange);
  }, [task, setPlaybackEnabled]);

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
      {!playbackEnabled && (
        <Box sx={{ margin: "-3em" }}>
          <LoadingIndicator sdsStyle="tag" />
        </Box>
      )}
    </Box>
  );
}
