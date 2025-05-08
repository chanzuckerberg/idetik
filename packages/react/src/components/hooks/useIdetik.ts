import { ChannelProps, ImageSeriesLayer } from "@idetik/core";
import { createContext, useContext } from "react";

export interface ChannelControl {
  label: string;
  contrastRange: [number, number];
}

export interface IdetikContextValue {
  isInitialized: boolean;

  channels: ChannelProps[];
  setChannels: (channels: ChannelProps[]) => void;
  resetChannels: () => void;

  channelControls: ChannelControl[]; // Same order as channels.
  setChannelControls: React.Dispatch<
    React.SetStateAction<ChannelControl[] | undefined>
  >;

  setImageSeriesLayer: React.Dispatch<
    React.SetStateAction<ImageSeriesLayer | undefined>
  >;
  clearImageSeriesLayer: () => void;
}

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
