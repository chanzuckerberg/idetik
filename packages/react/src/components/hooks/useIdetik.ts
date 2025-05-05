import { ImageSeriesLayer } from "@idetik/core";
import { createContext, useContext } from "react";

export interface IdetikContextValue {
  imageSeriesLayer?: ImageSeriesLayer;
  setImageSeriesLayer: (imageLayer: ImageSeriesLayer) => void;
}

export const IdetikContext = createContext<IdetikContextValue>({
  setImageSeriesLayer: () => {
    throw new Error(
      "<OmeZarrImageViewer> was initialized but your application was not wrapped with <IdetikProvider>."
    );
  },
});

/**
 * Gives you access to Idetik global state to write our own custom components.
 *
 * TODO(bchu): Make more global state available, make easier abstractions.
 */
export function useIdetik() {
  const { imageSeriesLayer, setImageSeriesLayer } = useContext(IdetikContext);

  return {
    imageSeriesLayer,
    setImageSeriesLayer,
  };
}
