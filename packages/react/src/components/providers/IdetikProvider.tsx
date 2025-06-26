"use client";

import { Idetik, OrthographicCamera, PanZoomControls } from "@idetik/core";
import { PropsWithChildren, useState, useEffect } from "react";
import { IdetikContext, IdetikContextValue } from "../../hooks/useIdetik";

/** Global Idetik state provider that you must wrap your application in. */
export const IdetikProvider = ({ children }: PropsWithChildren) => {
  const [camera] = useState<OrthographicCamera>(
    // default camera frame
    new OrthographicCamera(0, 128, 0, 128, -1000, 1000)
  );
  const [controls] = useState<PanZoomControls>(
    new PanZoomControls(camera, camera.position)
  );
  const [idetik, setIdetik] = useState<Idetik | null>(null);
  const [canvasRef, setCanvasRef] = useState<HTMLCanvasElement | null>(null);

  // Initialize Idetik when canvas becomes available
  useEffect(() => {
    if (canvasRef && !idetik) {
      const newIdetik = new Idetik({
        canvas: canvasRef,
        camera,
        controls,
      });
      newIdetik.start();
      setIdetik(newIdetik);
    }
  }, [canvasRef, camera, controls, idetik]);

  const idetikContext: IdetikContextValue = idetik
    ? {
        isReady: true,
        runtime: idetik,
        canvas: canvasRef!,
      }
    : {
        isReady: false,
        initializeWithCanvas: setCanvasRef,
      };

  return (
    <IdetikContext.Provider value={idetikContext}>
      {children}
    </IdetikContext.Provider>
  );
};
