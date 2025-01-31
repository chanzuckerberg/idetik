import { useEffect } from "react";
import {
  OmeZarrImageSource,
  LayerManager,
  OrthographicCamera,
  WebGLRenderer,
  ImageSeriesLayer,
  LayerState,
} from "@";
import { NullControls, PanZoomControls } from "@/objects/cameras/controls";
import { ChannelProps } from "@/objects/textures/channel";

const canvasId = "canvas";

// TODO: useRef for some of these objects
const camera = new OrthographicCamera(0, 840, 0, 360);
const controls = new PanZoomControls(camera, camera.position);
const layerManager = new LayerManager();

type RendererProps = {
  imageUrl: string;
  channels: ChannelProps[];
};

export default function Renderer({ imageUrl, channels }: RendererProps) {
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
      console.debug("Renderer::unmount");
      // TODO: cleanup by disposing objects owned by the renderer and camera.
      renderer.setControls(new NullControls());
      if (lastRequestId > 0) {
        console.debug(`Cancelling animation frame ${lastRequestId}`);
        cancelAnimationFrame(lastRequestId);
      }
    };
  }, []);

  // This should depend on channels, but we don't want to recrate the
  // whole layer when that changes.
  useEffect(() => {
    console.debug("useEffect::imageUrl", imageUrl);
    const source = new OmeZarrImageSource(imageUrl);
    const region = [{ dimension: "z", index: { start: 0, stop: 4 } }];
    const layer = new ImageSeriesLayer({
      source,
      region,
      timeDimension: "z",
      channelProps: channels,
    });

    if (layerManager.layers[0] instanceof ImageSeriesLayer) {
      layerManager.layers[0].close();
    }
    layerManager.layers.length = 0;
    layerManager.add(layer);

    const onStateChange = (state: LayerState) => {
      if (state === "ready") {
        layer.setTimeIndex(0);
      }
    };
    onStateChange(layer.state);
    layer.addStateChangeCallback(onStateChange);
    return () => {
      console.debug("useEffect::imageUrl:unmount");
      layer.removeStateChangeCallback(onStateChange);
    };
  }, [imageUrl]);

  useEffect(() => {
    console.debug("useEffect::channels", channels);
    if (layerManager.layers[0] instanceof ImageSeriesLayer) {
      layerManager.layers[0].setChannelProps(channels);
    }
  }, [channels]);

  return <canvas id={canvasId} style={{ width: "100%", height: "100%" }} />;
}
