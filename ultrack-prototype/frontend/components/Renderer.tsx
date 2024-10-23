import { Dispatch, SetStateAction, useEffect, useState } from "react";
import {
  ImageSeriesLayer,
  LayerManager,
  OmeZarrImageSource,
  OrthographicCamera,
  WebGLRenderer,
} from "@";

import { imageUrl } from "../lib/mock_data";
import { Task, taskLayers, tracksLayerCamera } from "../lib/tasks";

const canvasId = "canvas";

const imageSource = new OmeZarrImageSource(imageUrl);
let camera = new OrthographicCamera(0, 1920, 0, 1440);
const layerManager = new LayerManager();

type RendererProps = {
  curTime: number;
  playbackEnabled: boolean;
  setPlaybackEnabled: Dispatch<SetStateAction<boolean>>;
  task: Task;
};

export default function Renderer(props: RendererProps) {
  const { curTime, setPlaybackEnabled, task } = props;
  const [imageSeriesLayer, setImageSeriesLayer] =
    useState<ImageSeriesLayer | null>(null);

  useEffect(() => {
    console.debug("Renderer::useEffect::curTime: ", curTime);
    if (imageSeriesLayer !== null) {
      setTimeIndexWhenReady(imageSeriesLayer, curTime);
    }
  }, [curTime, imageSeriesLayer]);

  useEffect(() => {
    setPlaybackEnabled(false);
    if (!task) {
      return;
    }
    const { tracksLayer, imageSeriesLayer } = taskLayers(task, imageSource);
    imageSeriesLayer.update();
    setImageSeriesLayer(imageSeriesLayer);

    // TODO: need to remove observer as part of dismount function.
    // https://github.com/chanzuckerberg/imaging-active-learning/issues/77
    imageSeriesLayer.onStateChange((newState) => {
      if (newState === "ready") {
        setPlaybackEnabled(true);
        layerManager.layers.length = 0;
        layerManager.add(tracksLayer);
        layerManager.add(imageSeriesLayer);
        // TODO: update the camera in-place instead of creating a new one (this will make zoom/pan callbacks easier to manage)
        camera = tracksLayerCamera(tracksLayer, 2.0);
      }
    });
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
    <canvas
      id={canvasId}
      style={{
        width: "100%",
        height: "100%",
        flex: 1,
        minHeight: 0,
      }}
    />
  );
}

function setTimeIndexWhenReady(layer: ImageSeriesLayer, timeIndex: number) {
  if (layer.state === "ready") {
    layer.setTimeIndex(timeIndex);
  } else {
    layer.onStateChange((newState) => {
      if (newState === "ready") {
        layer.setTimeIndex(timeIndex);
      }
    });
  }
}
