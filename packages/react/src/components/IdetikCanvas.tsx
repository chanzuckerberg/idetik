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
      console.debug("IdetikCanvas mounting with canvas", canvas, contextValue);
      if (canvas === null) {
        contextValue.runtime?.stop();
      } else if (!contextValue.isReady) {
        contextValue.initializeWithCanvas(canvas);
      } else {
        contextValue.runtime.start();
      }
    },
    [contextValue]
  );

  return (
    <canvas ref={canvasCallbackRef} id={canvasId} className={classNames} />
  );
}
