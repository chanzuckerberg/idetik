"use client";

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
  return (
    <canvas
      ref={contextValue.canvasRefCallback}
      id={canvasId}
      className={classNames}
    />
  );
}
