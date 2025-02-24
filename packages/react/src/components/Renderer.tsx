import { useEffect, useRef } from "react";
import {
  ImageLayer,
  OmeZarrImageSource,
  LayerManager,
  OrthographicCamera,
  PanZoomControls,
  WebGLRenderer,
} from "@idetik/core";

// TODO: needs to be unique so we can have more than one on the page
const canvasId = "canvas";

// TODO: useRef for some of these objects
const camera = new OrthographicCamera(0, 825, 0, 500);
const layerManager = new LayerManager();

// TODO: use props to pass in most of this config
const plateUrl =
  "http://localhost:8080/20200812-CardiomyocyteDifferentiation14-Cycle1_mip.zarr";
const imageUrl = plateUrl + "/B/03/0";
console.debug(`Loading image from ${imageUrl}`);
const source = new OmeZarrImageSource(imageUrl);
const region = [
  { dimension: "c", index: { start: 0, stop: 3 } },
  { dimension: "z", index: 0 },
];

// colors and limits come from the OME-Zarr metadata
// http://localhost:8080/20200812-CardiomyocyteDifferentiation14-Cycle1_mip.zarr/B/03/0/.zattrs
const channelProps = [
  { color: [0, 1, 1], contrastLimits: [110, 800] },
  { color: [1, 0, 1], contrastLimits: [110, 250] },
  { color: [1, 1, 0], contrastLimits: [110, 800] },
];
// TODO: typescript is not checking the types of the arguments to the constructor
// see https://github.com/chanzuckerberg/imaging-active-learning/issues/174
const layer = new ImageLayer({ source, region, channelProps });
layerManager.add(layer);

interface RendererProps {
  onLayerReady?: (layer: ImageLayer) => void;
}

export default function Renderer({ onLayerReady }: RendererProps) {
  const renderer = useRef<WebGLRenderer | null>(null);

  useEffect(() => {
    console.debug("Renderer::mount");
    let lastRequestId = 0;

    // Initialize renderer if not already done
    if (renderer.current === null) {
      renderer.current = new WebGLRenderer(`#${canvasId}`);
      const controls = new PanZoomControls(camera, camera.position);
      renderer.current.setControls(controls);

      // Notify parent about the layer
      onLayerReady?.(layer);
    }

    function animate() {
      renderer.current?.render(layerManager, camera);
      lastRequestId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      if (lastRequestId > 0) {
        console.debug(`Cancelling animation frame ${lastRequestId}`);
        cancelAnimationFrame(lastRequestId);
      }
    };
  }, [onLayerReady]);

  return <canvas id={canvasId} style={{ width: "100%", height: "100%" }} />;
}
