import { ChannelProps, ImageSeriesLayer } from "@idetik/core";
import { createContext, useCallback, useContext } from "react";

export interface ChannelControl {
  label: string;
  contrastRange: [number, number];
}

export interface IdetikContextValue {
  imageSeriesLayer?: ImageSeriesLayer;
  setImageSeriesLayer: React.Dispatch<
    React.SetStateAction<ImageSeriesLayer | undefined>
  >;
  channelControls?: ChannelControl[]; // Same order as ImageSeriesLayer.channelProps
  setChannelControls: React.Dispatch<
    React.SetStateAction<ChannelControl[] | undefined>
  >;
}

export const IdetikContext = createContext<IdetikContextValue>({
  setImageSeriesLayer: () => {
    throw new Error(
      "<OmeZarrImageViewer> was initialized but your application was not wrapped with <IdetikProvider>."
    );
  },
  setChannelControls: () => {
    throw new Error(
      "Viewer controls were initialized but your application was not wrapped with <IdetikProvider>."
    );
  },
});

/** Gives you access to Idetik global state to write our own custom components. */
export function useIdetik() {
  const {
    imageSeriesLayer,
    setImageSeriesLayer,
    channelControls,
    setChannelControls,
  } = useContext(IdetikContext);

  const clearImageSeriesLayer = useCallback(() => {
    imageSeriesLayer?.close();
    setImageSeriesLayer(undefined);
  }, [imageSeriesLayer, setImageSeriesLayer]);
  const setChannels = useCallback(
    (channelProps: ChannelProps[]) => {
      imageSeriesLayer?.setChannelProps(channelProps);
    },
    [imageSeriesLayer]
  );

  return {
    channels: imageSeriesLayer?.channelProps,
    setChannels,

    setImageSeriesLayer,
    clearImageSeriesLayer,

    channelControls,
    setChannelControls,
  };
}
