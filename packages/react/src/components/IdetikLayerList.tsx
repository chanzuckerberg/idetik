"use client";

import { Layer } from "@idetik/core";
import { useSyncExternalStore } from "react";
import { useIdetik } from "./hooks/useIdetik";

// Stable empty array reference to avoid infinite renders
const EMPTY_LAYERS: Layer[] = [];

/** Component that displays a reactive list of layers from the LayerManager */
export function IdetikLayerList() {
  const contextValue = useIdetik();

  const layers = useSyncExternalStore(
    (callback) => {
      if (!contextValue) return () => {};
      return contextValue.idetik.layerManager.addCallback(callback);
    },
    () => {
      if (!contextValue) return EMPTY_LAYERS;
      return contextValue.idetik.layerManager.getSnapshot();
    }
  );

  if (!contextValue) {
    return <div>No Idetik context available</div>;
  }

  return (
    <div>
      <h3>Layers ({layers.length})</h3>
      {layers.length === 0 ? (
        <p>No layers</p>
      ) : (
        <ul>
          {layers.map((layer: Layer, index: number) => (
            <li key={index}>
              {`Layer ${index + 1}`}
              <button
                onClick={() => contextValue.removeLayer(layer)}
                style={{ marginLeft: "8px" }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
