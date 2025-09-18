"use client";

import {
  Idetik,
  OrthographicCamera,
  PanZoomControls,
} from "@idetik/core-prerelease";
import { PropsWithChildren, useState } from "react";
import { IdetikContext } from "../../hooks/useIdetik";

/** Global Idetik state provider that you must wrap your application in. */
export const IdetikProvider = ({ children }: PropsWithChildren) => {
  const [runtime, setRuntime] = useState<Idetik | null>(null);

  const canvasRefCallback = (canvas: HTMLCanvasElement | null) => {
    console.debug("IdetikProvider: canvasRefCallback", canvas, runtime);
    // Canvas unmounted
    if (canvas === null) {
      // Stop the runtime if it has been created.
      if (runtime !== null) {
        runtime.stop();
        setRuntime(null);
      }
      // Both the canvas and runtime may be null (e.g. in React strict mode).
      return;
    }
    // Canvas mounted.
    if (runtime !== null) {
      if (runtime.canvas !== canvas) {
        throw new Error("Only one IdetikCanvas can be mounted at a time.");
      }
      // The canvas may be the same as the existing one (e.g. in React strict mode).
      return;
    }
    // The canvas is mounted and there is no existing runtime, so create and start
    // a new runtime associated with it.
    const camera = new OrthographicCamera(0, 128, 0, 128, -1000, 1000);
    const cameraControls = new PanZoomControls(camera);
    const newRuntime = new Idetik({
      canvas,
      camera,
      cameraControls,
    });
    newRuntime.start();
    setRuntime(newRuntime);
  };

  return (
    <IdetikContext.Provider value={{ runtime, canvasRefCallback }}>
      {children}
    </IdetikContext.Provider>
  );
};
