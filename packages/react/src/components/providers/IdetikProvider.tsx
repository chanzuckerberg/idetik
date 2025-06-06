"use client";

import {
  Idetik,
  Layer,
  OrthographicCamera,
  PanZoomControls,
} from "@idetik/core";
import {
  PropsWithChildren,
  RefObject,
  useState,
  useEffect,
  useCallback,
} from "react";
import { IdetikContext, IdetikContextValue } from "../hooks/useIdetik";

interface IdetikProviderProps {
  canvasRef: RefObject<HTMLCanvasElement>;
}

/** Global Idetik state provider that you must wrap your application in. */
export const IdetikProvider = ({
  canvasRef,
  children,
}: PropsWithChildren<IdetikProviderProps>) => {
  const [camera] = useState<OrthographicCamera>(
    // default camera frame
    new OrthographicCamera(-1, 1, 1, -1)
  );
  const [controls] = useState<PanZoomControls>(
    new PanZoomControls(camera, camera.position)
  );
  const [idetik, setIdetik] = useState<Idetik | null>(null);

  // Initialize Idetik when canvas becomes available
  useEffect(() => {
    if (canvasRef.current && !idetik) {
      const newIdetik = new Idetik({
        canvas: canvasRef.current,
        camera,
        controls,
      });
      newIdetik.start();
      setIdetik(newIdetik);
    }
  }, [canvasRef, camera, controls, idetik]);

  const addLayer = useCallback(
    (layer: Layer) => {
      idetik?.layerManager.add(layer);
    },
    [idetik]
  );

  const removeLayer = useCallback(
    (layer: Layer) => {
      idetik?.layerManager.remove(layer);
    },
    [idetik]
  );

  const idetikContext: IdetikContextValue | null = idetik
    ? {
        idetik,
        addLayer,
        removeLayer,
      }
    : null;

  return (
    <IdetikContext.Provider value={idetikContext}>
      {children}
    </IdetikContext.Provider>
  );
};
