import { Layer } from "@idetik/core";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useIdetik } from "./useIdetik";

// Stable empty array reference to avoid infinite renders
const EMPTY_LAYERS: Layer[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useLayers = (
  createLayers: () => Layer[],
  deps: any[]
): Layer[] => {
  const [managedLayers, setManagedLayers] = useState<Layer[]>([]);
  const contextValue = useIdetik();

  // Subscribe to all layer changes in the LayerManager
  const allLayers = useSyncExternalStore(
    (callback) => {
      if (!contextValue) return () => {};
      return contextValue.idetik.layerManager.addCallback(callback);
    },
    () => {
      if (!contextValue) return EMPTY_LAYERS;
      return contextValue.idetik.layerManager.getSnapshot();
    }
  );

  // Filter to only return the layers we're managing that still exist in LayerManager
  const activeManagedLayers = managedLayers.filter((layer) =>
    allLayers.includes(layer)
  );

  useEffect(() => {
    if (!contextValue) return;

    const newLayers = createLayers();

    newLayers.forEach((layer) => contextValue.addLayer(layer));
    setManagedLayers(newLayers);

    return () => {
      try {
        // Attempt to remove layers when the component unmounts
        newLayers.forEach((layer) => contextValue.removeLayer(layer));
      } catch (error) {
        // Not a big deal if they've already been cleaned up by something else
        console.warn("Layer not found in context during cleanup", error);
      }
    };
    // We specifically *don't* include createLayers in the deps array or else this effect
    // will run on every render. Is there some way to detect changes to the fn itself without
    // wrapping it in `useCallback` everywhere?
    // The linter also complains about `...deps` being missing from the dependency array, but
    // I don't think we can fix this. Maybe the linter can analyze at the call site?
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextValue, ...deps]);

  // Clear managed layers when context isn't available
  useEffect(() => {
    if (!contextValue) {
      setManagedLayers([]);
    }
  }, [contextValue]);

  return activeManagedLayers;
};
