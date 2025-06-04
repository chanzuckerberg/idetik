"use client";

import { Idetik, ImageSeriesLayer } from "@idetik/core";
import {
  PropsWithChildren,
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ChannelControl,
  IdetikContext,
  IdetikContextValue,
} from "../hooks/useIdetik";

// The return value of the getSnapshot argument to useSyncExternalStore() must be memoized to
// prevent infinite rerenders.
const EMPTY_ARRAY: never[] = [];

/** Global Idetik state provider that you must wrap your application in. */
export const IdetikProvider = ({ children }: PropsWithChildren) => {
  const getImageSeriesLayer = (): ImageSeriesLayer | undefined =>
    idetik?.layerManager.layers[0] as ImageSeriesLayer;

  // GLOBAL STATE:
  const [idetik, setIdetik] = useState<Idetik | undefined>(undefined);
  const channels = useSyncExternalStore(
    getImageSeriesLayer()?.addChannelChangeCallback ?? (() => () => {}),
    () => getImageSeriesLayer()?.channelProps ?? EMPTY_ARRAY,
    () => EMPTY_ARRAY // Doesn't render anything on SSR
  );
  const [channelControls, setChannelControls] = useState<Array<ChannelControl>>(
    []
  );

  // MEMOIZED CALLBACKS:
  const clear = useCallback(() => {
    getImageSeriesLayer()?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- idetik is the only real dependency.
  }, [idetik]);

  // CONTEXT VALUE:
  const contextValue = useMemo<IdetikContextValue>(
    () =>
      idetik !== undefined
        ? {
            isInitialized: true,
            idetik,
            channels,
            channelControls,
            setIdetik,
            clear,
            setChannelControls,
          }
        : {
            isInitialized: false,
            channels,
            channelControls,
            setIdetik,
            clear,
            setChannelControls,
          },
    [channels, idetik, channelControls, clear]
  );

  return (
    <IdetikContext.Provider value={contextValue}>
      {children}
    </IdetikContext.Provider>
  );
};
