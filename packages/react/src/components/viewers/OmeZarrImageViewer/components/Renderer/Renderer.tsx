import { useEffect, useRef } from "react";
import {
  LayerManager,
  OrthographicCamera,
  CameraControls,
  PanZoomControls,
  NullControls,
  WebGLRenderer,
} from "@idetik/core";

type ControlType = "panzoom" | "none";

interface RendererProps {
  layerManager: LayerManager;
  camera: OrthographicCamera;
  cameraControls?: ControlType;
  canvasId?: string;
}

export function Renderer({
  layerManager,
  camera,
  cameraControls = "panzoom",
  canvasId = "renderer",
}: RendererProps) {
  const renderer = useRef<WebGLRenderer | null>(null);
  const controls = useRef<CameraControls>(new NullControls());

  switch (cameraControls) {
    case "panzoom":
      controls.current = new PanZoomControls(camera, camera.position);
      break;
    case "none":
      controls.current = new NullControls();
      break;
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
  }, [canvasId, camera, layerManager]);

  return <canvas id={canvasId} style={{ width: "100%", height: "100%" }} />;
}
