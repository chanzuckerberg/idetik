"use client";

import { Idetik, ImageSeriesLayer } from "@idetik/core";
import {
  PropsWithChildren,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ChannelControl,
  IdetikContext,
  IdetikContextValue,
} from "../hooks/useIdetik";

// When the layer is not initialized yet, we can't instantiate a new (unstable) [] every render b/c
// it will cause useSyncExternalStore() to re-render, resulting in another [] instance, which will
// cause React to re-render again, resulting in an infinite loop.
const EMPTY_ARRAY: never[] = [];

/** Global Idetik state provider that you must wrap your application in. */
export const IdetikProvider = ({ children }: PropsWithChildren) => {
  const [idetik, setIdetik] = useState<Idetik | undefined>(undefined);
  const imageSeriesLayer = idetik?.layerManager.layers[0] as
    | ImageSeriesLayer
    | undefined;
  const channels = useSyncExternalStore(
    imageSeriesLayer?.addChannelChangeCallback ?? (() => () => {}),
    () => imageSeriesLayer?.channelProps ?? EMPTY_ARRAY,
    () => EMPTY_ARRAY // Doesn't render anything on SSR
  );
  const [channelControls, setChannelControls] = useState<Array<ChannelControl>>(
    []
  );

  const contextValue = useMemo<IdetikContextValue>(
    () =>
      idetik !== undefined
        ? {
            isInitialized: true,
            idetik,
            channels,
            channelControls,
            setIdetik,
            setChannelControls,
          }
        : {
            isInitialized: false,
            channels,
            channelControls,
            setIdetik,
            setChannelControls,
          },
    [channels, idetik, channelControls]
  );

  return (
    <IdetikContext.Provider value={contextValue}>
      {children}
    </IdetikContext.Provider>
  );
};
