"use client";

import { Layer } from "@idetik/core";
import { useIdetik } from "./hooks/useIdetik";

/** Component that displays a reactive list of layers from the LayerManager */
export function IdetikLayerList() {
  const { isReady: isReady, methods, activeLayers } = useIdetik();

  if (!isReady || !methods) {
    return <div>No Idetik context available</div>;
  }

  return (
    <div>
      <h3>Layers ({activeLayers.length})</h3>
      {activeLayers.length === 0 ? (
        <p>No layers</p>
      ) : (
        <ul>
          {activeLayers.map((layer: Layer, index: number) => (
            <li key={index}>
              {layer.type} {index + 1}
              <button
                onClick={() => methods.removeLayer(layer)}
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
