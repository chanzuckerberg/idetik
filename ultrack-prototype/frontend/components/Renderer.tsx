import { Dispatch, SetStateAction, useEffect, useState } from "react";
import {
  ImageSeriesLayer,
  LayerManager,
  LayerState,
  OmeZarrImageSource,
  OrthographicCamera,
  TracksLayer,
  WebGLRenderer,
} from "@";

// TODO: imageURL should come from the server (probably with each task)
import { imageUrl } from "../lib/mock_data";
import { Task } from "../lib/tasks";
import { Box } from "@mui/material";
import { LoadingIndicator } from "@czi-sds/components";
import { PanZoomControls } from "@/objects/cameras/controls";

const canvasId = "canvas";

// TODO: consider useRef for these objects
const imageSource = new OmeZarrImageSource(imageUrl);
const camera = new OrthographicCamera(0, 1920, 0, 1440);
const controls = new PanZoomControls(camera, camera.position);
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
  const [tracksLayer, setTracksLayer] = useState<TracksLayer | null>(null);

  useEffect(() => {
    console.debug("Renderer::useEffect::curTime: ", curTime);
    if (imageSeriesLayer === null || tracksLayer === null) return;
    if (imageSeriesLayer.state === "ready") {
      imageSeriesLayer.setTimeIndex(curTime);
      tracksLayer.setTimeIndex(curTime);
      return;
    }
    const onStateChange = (newState: LayerState) => {
      if (newState === "ready") {
        imageSeriesLayer.setTimeIndex(curTime);
        tracksLayer.setTimeIndex(curTime);
      }
    };
    imageSeriesLayer.addStateChangeCallback(onStateChange);
    return () => imageSeriesLayer.removeStateChangeCallback(onStateChange);
  }, [curTime, imageSeriesLayer, tracksLayer]);

  useEffect(() => {
    console.debug("Renderer::useEffect::task: ", task);
    setPlaybackEnabled(false);
    if (!task) {
      return;
    }
    const { tracksLayer, imageSeriesLayer } = task.layers(imageSource);
    imageSeriesLayer.update();
    setImageSeriesLayer(imageSeriesLayer);
    setTracksLayer(tracksLayer);
    const onStateChange = (newState: LayerState) => {
      if (newState === "ready") {
        setPlaybackEnabled(true);
        // TODO: update the data on the layers instead of creating new ones
        layerManager.layers.length = 0;
        layerManager.add(imageSeriesLayer);
        layerManager.add(tracksLayer);
        const extent = tracksLayer.extent;
        camera.setFrame(extent.xMin, extent.xMax, extent.yMax, extent.yMin);
        camera.zoom = 0.25;
        controls.panTarget = camera.position;
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
