import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import {
  ImageSeriesLayer,
  LayerManager,
  LayerState,
  OrthographicCamera,
  TracksLayer,
  WebGLRenderer,
  Box2,
} from "@idetik/core";

// TODO: imageURL should come from the server (probably with each task)
import { Task } from "../lib/tasks";
import { Box } from "@mui/material";
import { LoadingIndicator } from "@czi-sds/components";
import { vec2 } from "gl-matrix";

const canvasId = "canvas";

// TODO: consider useRef for these objects
const camera = new OrthographicCamera(0, 1920, 0, 1440);
const layerManager = new LayerManager();

export default function Renderer({
  curTime,
  playbackEnabled,
  setPlaybackEnabled,
  task,
}: {
  curTime: number;
  playbackEnabled: boolean;
  setPlaybackEnabled: Dispatch<SetStateAction<boolean>>;
  task: Task | null;
}) {
  const [imageSeriesLayer, setImageSeriesLayer] =
    useState<ImageSeriesLayer | null>(null);
  const [tracksLayer, setTracksLayer] = useState<TracksLayer | null>(null);
  const lastTaskId = useRef("");

  useEffect(() => {
    console.debug("Renderer::useEffect::curTime: ", curTime);
    if (imageSeriesLayer === null || tracksLayer === null) return;
    imageSeriesLayer.setPosition(curTime);
    tracksLayer.setTimeIndex(curTime);
  }, [curTime, imageSeriesLayer, tracksLayer]);

  useEffect(() => {
    console.debug("Renderer::useEffect::task: ", task);
    if (task?.taskId === lastTaskId.current) return;
    setPlaybackEnabled(false);
    if (!task) return;
    lastTaskId.current = task.taskId;
    const { tracksLayer, imageSeriesLayer } = task.layers();
    setImageSeriesLayer((prevLayer: ImageSeriesLayer | null) => {
      prevLayer?.close();
      return imageSeriesLayer;
    });
    setTracksLayer(tracksLayer);
    const onReady = () => {
      setPlaybackEnabled(true);
      // TODO: update the data on the layers instead of creating new ones
      layerManager.removeAll();
      layerManager.add(imageSeriesLayer);
      layerManager.add(tracksLayer);
      const extent = tracksLayer.extent;
      camera.setFrame(extent.xMin, extent.xMax, extent.yMax, extent.yMin);
      camera.zoom(0.25);
    };
    if (imageSeriesLayer.state === "ready") {
      onReady();
    }
    const onStateChange = (newState: LayerState) => {
      if (newState === "ready") {
        onReady();
        imageSeriesLayer.removeStateChangeCallback(onStateChange);
      }
    };
    imageSeriesLayer.addStateChangeCallback(onStateChange);
    return () => {
      imageSeriesLayer.removeStateChangeCallback(onStateChange);
    };
  }, [task, setPlaybackEnabled]);

  // Use the mount-effect so that the renderer can find the corresponding
  // element by its ID.
  useEffect(() => {
    console.debug("Renderer::mount");
    let lastRequestId = 0;
    const canvas = document.querySelector<HTMLCanvasElement>(`#${canvasId}`)!;
    const renderer = new WebGLRenderer(canvas);
    let needsResize = false;
    const resizeObserver = new ResizeObserver(() => {
      needsResize = true;
    });
    resizeObserver.observe(canvas);
    function animate() {
      if (needsResize) {
        renderer.updateSize();
        needsResize = false;
      }
      const viewportBox = new Box2(
        vec2.fromValues(0, 0),
        vec2.fromValues(renderer.width, renderer.height)
      );
      renderer.render(layerManager, camera, viewportBox);
      lastRequestId = requestAnimationFrame(animate);
    }
    animate();
    return () => {
      // TODO: cleanup by disposing objects owned by the renderer and camera.
      if (lastRequestId > 0) {
        console.debug(`Cancelling animation frame ${lastRequestId}`);
        cancelAnimationFrame(lastRequestId);
      }
      resizeObserver.disconnect();
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
