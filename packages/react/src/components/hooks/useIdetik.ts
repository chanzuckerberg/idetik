import { Idetik, Layer } from "@idetik/core";
import { createContext, useContext } from "react";


export type IdetikContextValue = {
  idetik: Idetik,
  addLayer: (layer: Layer) => void,
  removeLayer: (layer: Layer) => void,
};

export const IdetikContext = createContext<IdetikContextValue | null>(null);

/** Gives you access to Idetik global state to write our own custom components. */
export function useIdetik(): IdetikContextValue | null {
  const contextValue = useContext(IdetikContext);
  return contextValue;
}
