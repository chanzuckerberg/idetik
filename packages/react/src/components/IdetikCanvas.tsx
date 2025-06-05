"use client";

import { forwardRef, HTMLProps } from "react";

type IdetikCanvasProps = HTMLProps<HTMLCanvasElement>;

/** Canvas component for Idetik visualization. Must be used inside IdetikProvider. */
export const IdetikCanvas = forwardRef<HTMLCanvasElement, IdetikCanvasProps>(
  (props, ref) => {
    return <canvas ref={ref} {...props} />;
  }
);

IdetikCanvas.displayName = "IdetikCanvas";