import { useEffect, useRef } from "react";
import {
  LayerManager,
  OrthographicCamera,
  PanZoomControls,
  NullControls,
  WebGLRenderer,
} from "@idetik/core";

type Controls = PanZoomControls | NullControls;

export default function Renderer({
  layerManager,
  camera,
  enableControls = true,
  canvasId = "renderer",
}: {
  layerManager: LayerManager,
  camera: OrthographicCamera,
  // TODO: in the future this could be an enum for control type or something
  enableControls: boolean,
  canvasId?: string,  // allows for multiple renderers on the page
}) {
  console.log("Renderer::", layerManager, camera, enableControls, canvasId);
  const renderer = useRef<WebGLRenderer | null>(null);
  const controls = useRef<Controls>(() => new NullControls());

  if (enableControls) {
    controls.current = new PanZoomControls(camera, camera.position);
  } else if (!enableControls && controls.current !== null) {
    controls.current = new NullControls();
  }
  renderer.current?.setControls(controls.current);

  // Use the mount-effect so that the renderer can find the corresponding
  // element by its ID.
  useEffect(() => {
    console.debug("Renderer::mount");
    let lastRequestId = 0;
    if (!renderer.current) {
      renderer.current = new WebGLRenderer(`#${canvasId}`);
      console.debug(`Created WebGLRenderer for ${canvasId}`, renderer.current);
      renderer.current.setControls(controls.current);
    }
    function animate() {
      renderer.current.render(layerManager, camera);
      lastRequestId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      if (lastRequestId > 0) {
        console.debug(`Cancelling animation frame ${lastRequestId}`);
        cancelAnimationFrame(lastRequestId);
      }
    };
  }, [canvasId, camera, layerManager]);

  return <canvas id={canvasId} style={{ width: "100%", height: "100%" }} />;
}
