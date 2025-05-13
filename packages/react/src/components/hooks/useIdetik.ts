import { ChannelProps, ImageSeriesLayer } from "@idetik/core";
import { createContext, useContext } from "react";

export interface ChannelControl {
  label: string;
  contrastRange: [number, number];
}

export type IdetikContextValue =
  | {
      isInitialized: true;
      imageSeriesLayer: ImageSeriesLayer;
      channels: ChannelProps[];
      channelControls: ChannelControl[]; // Same order as channels.
      setImageSeriesLayer: React.Dispatch<
        React.SetStateAction<ImageSeriesLayer | undefined>
      >;
      clearImageSeriesLayer: () => void;
      setChannelControls: React.Dispatch<
        React.SetStateAction<Array<ChannelControl>>
      >;
    }
  | {
      isInitialized: false;
      setImageSeriesLayer: React.Dispatch<
        React.SetStateAction<ImageSeriesLayer | undefined>
      >;
      setChannelControls: React.Dispatch<
        React.SetStateAction<Array<ChannelControl>>
      >;
    };

export const IdetikContext = createContext<IdetikContextValue | undefined>(
  undefined
);

/** Gives you access to Idetik global state to write our own custom components. */
export function useIdetik(): IdetikContextValue {
  const contextValue = useContext(IdetikContext);
  if (contextValue === undefined) {
    throw new Error("You must wrap your application in <IdetikProvider>.");
  }

  return contextValue;
}
