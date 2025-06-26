"use client";

import { useCallback } from "react";
import { useIdetik } from "../hooks/useIdetik";

interface IdetikCanvasProps {
  canvasId?: string;
  style?: React.CSSProperties;
}

export function IdetikCanvas({
  canvasId = "idetik-canvas",
  style = { width: "100%", height: "100%" },
}: IdetikCanvasProps) {
  const contextValue = useIdetik();

  const canvasCallbackRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!contextValue.isReady && canvas) {
        contextValue.initializeWithCanvas(canvas);
      }
    },
    [contextValue]
  );

  return (
    <canvas
      ref={canvasCallbackRef}
      id={canvasId}
      className="idetik-canvas"
      style={style}
    />
  );
}
