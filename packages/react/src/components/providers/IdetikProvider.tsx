"use client";

import {
  Idetik,
  Layer,
  OrthographicCamera,
  PanZoomControls,
} from "@idetik/core";
import {
  PropsWithChildren,
  useState,
  useEffect,
  useCallback,
  useSyncExternalStore,
  useMemo,
} from "react";
import { IdetikContext, IdetikContextValue } from "../hooks/useIdetik";

// Stable empty array reference to avoid infinite renders
const EMPTY_LAYERS: Layer[] = [];

/** Global Idetik state provider that you must wrap your application in. */
export const IdetikProvider = ({ children }: PropsWithChildren) => {
  const [camera] = useState<OrthographicCamera>(
    // default camera frame
    new OrthographicCamera(-1, 1, 1, -1)
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

  const isLayerActive = useCallback(
    (layer: Layer) => {
      if (!idetik) return false;
      return idetik.layerManager.layers.includes(layer);
    },
    [idetik]
  );

  const activeLayers = useSyncExternalStore(
    (callback) => {
      if (!idetik) return () => {};
      return idetik.layerManager.addCallback(callback);
    },
    () => {
      if (!idetik) return EMPTY_LAYERS;
      return idetik.layerManager.getSnapshot();
    },
    // fallback for SSR/initial render
    () => EMPTY_LAYERS
  );

  const methods = useMemo(
    () => ({
      addLayer,
      removeLayer,
      isLayerActive,
    }),
    [addLayer, removeLayer, isLayerActive]
  );

  const idetikContext: IdetikContextValue = idetik
    ? {
        isReady: true,
        activeLayers,
        methods,
        runtime: idetik,
      }
    : {
        isReady: false,
        activeLayers: [],
        methods: null,
        runtime: null,
        initializeWithCanvas: setCanvasRef,
      };

  return (
    <IdetikContext.Provider value={idetikContext}>
      {children}
    </IdetikContext.Provider>
  );
};
