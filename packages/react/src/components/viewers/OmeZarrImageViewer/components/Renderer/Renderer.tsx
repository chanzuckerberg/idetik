import { useEffect, useRef } from "react";
import {
  CameraControls,
  PanZoomControls,
  NullControls,
  WebGLRenderer,
} from "@idetik/core";
import { useIdetik } from "components/hooks";

type ControlType = "panzoom" | "none";

interface RendererProps {
  cameraControls?: ControlType;
  canvasId?: string;
}

export function Renderer({
  cameraControls = "panzoom",
  canvasId = "renderer",
}: RendererProps) {
  const renderer = useRef<WebGLRenderer | null>(null);
  const controls = useRef<CameraControls>(new NullControls());
  const { idetik } = useIdetik();

  useEffect(() => {
    console.debug("Renderer::setControls");
    if (idetik?.camera && cameraControls === "panzoom") {
      controls.current = new PanZoomControls(
        idetik.camera,
        idetik.camera.position
      );
    } else {
      controls.current = new NullControls();
    }
    renderer.current?.setControls(controls.current);
  }, [idetik, cameraControls]);

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
      if (!idetik?.camera) {
        return;
      }
      renderer.current?.render(idetik.layerManager, idetik.camera);
      lastRequestId = requestAnimationFrame(animate);
    }
    animate();
    return () => {
      if (lastRequestId > 0) {
        console.debug(`Cancelling animation frame ${lastRequestId}`);
        cancelAnimationFrame(lastRequestId);
      }
    };
  }, [idetik, canvasId]);

  return <canvas id={canvasId} style={{ width: "100%", height: "100%" }} />;
}
