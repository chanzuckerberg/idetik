import { useEffect } from "react";
import { useIdetik } from "../../../../hooks";

interface RendererProps {
  canvasId?: string;
}

export function Renderer({ canvasId = "renderer" }: RendererProps) {
  const { idetik } = useIdetik();

  // Use the mount-effect so that the renderer can find the corresponding
  // element by its ID.
  useEffect(() => {
    console.debug("Renderer::mount");
    idetik?.start();
    return () => {
      idetik?.stop();
    };
  }, [idetik, canvasId]);

  return <canvas id={canvasId} style={{ width: "100%", height: "100%" }} />;
}
