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
    // Canvas unmounted, so stop the runtime if it has been created.
    if (canvas === null && runtime !== null) {
      runtime.stop();
      setRuntime(null);
      return;
    }
    // Canvas mounted, so create and start a new runtime associated with it.
    if (canvas !== null && runtime === null) {
      const camera = new OrthographicCamera(0, 128, 0, 128, -1000, 1000);
      const cameraControls = new PanZoomControls(camera);
      const newRuntime = new Idetik({
        canvas,
        camera,
        cameraControls,
      });
      newRuntime.start();
      setRuntime(newRuntime);
      return;
    }
  };

  return (
    <IdetikContext.Provider value={{ runtime, canvasRefCallback }}>
      {children}
    </IdetikContext.Provider>
  );
};
