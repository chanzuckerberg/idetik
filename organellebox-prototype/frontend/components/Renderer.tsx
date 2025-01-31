import { useEffect } from "react";
import {
  ImageLayer,
  OmeZarrImageSource,
  LayerManager,
  OrthographicCamera,
  WebGLRenderer,
} from "@";
import { NullControls, PanZoomControls } from "@/objects/cameras/controls";

const canvasId = "canvas";

// TODO: useRef for some of these objects
const camera = new OrthographicCamera(0, 840, 0, 360);
const controls = new PanZoomControls(camera, camera.position);
const layerManager = new LayerManager();

type RendererProps = {
  imageUrl: string;
};

export default function Renderer({ imageUrl }: RendererProps) {
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
      renderer.setControls(new NullControls());
      if (lastRequestId > 0) {
        console.debug(`Cancelling animation frame ${lastRequestId}`);
        cancelAnimationFrame(lastRequestId);
      }
    };
  }, []);

  useEffect(() => {
    console.debug("useEffect::imageUrl", imageUrl);
    layerManager.layers.length = 0;

    const source = new OmeZarrImageSource(imageUrl);
    const region = [
      { dimension: "c", index: 0 },
      { dimension: "z", index: 0 },
    ];
    const layer = new ImageLayer({
      source,
      region,
      channelProps: { contrastLimits: [110, 800] as [number, number] },
    });
    layerManager.add(layer);
  }, [imageUrl]);

  return <canvas id={canvasId} style={{ width: "100%", height: "100%" }} />;
}
