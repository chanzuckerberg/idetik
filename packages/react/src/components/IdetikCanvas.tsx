"use client";

import { useCallback } from "react";
import { useIdetik } from "../hooks/useIdetik";

interface IdetikCanvasProps {
  canvasId?: string;
  classNames?: string;
}

export function IdetikCanvas({
  canvasId = "idetik-canvas",
  classNames = "w-full h-full",
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
    <canvas ref={canvasCallbackRef} id={canvasId} className={classNames} />
  );
}
