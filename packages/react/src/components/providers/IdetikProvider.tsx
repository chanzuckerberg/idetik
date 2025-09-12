"use client";

import {
  Idetik,
  OrthographicCamera,
  PanZoomControls,
} from "@idetik/core-prerelease";
import { PropsWithChildren, useState } from "react";
import { IdetikContext, IdetikContextValue } from "../../hooks/useIdetik";

/** Global Idetik state provider that you must wrap your application in. */
export const IdetikProvider = ({ children }: PropsWithChildren) => {
  const [idetikContext, setIdetikContext] = useState<IdetikContextValue>({
    isReady: false,
    runtime: null,
    initializeWithCanvas: (canvas: HTMLCanvasElement) => {
      const camera = new OrthographicCamera(0, 128, 0, 128, -1000, 1000);
      const cameraControls = new PanZoomControls(camera);
      const newIdetik = new Idetik({
        canvas,
        camera,
        cameraControls,
      });
      newIdetik.start();
      setIdetikContext({
        isReady: true,
        runtime: newIdetik,
      });
    },
  });

  return (
    <IdetikContext.Provider value={idetikContext}>
      {children}
    </IdetikContext.Provider>
  );
};
