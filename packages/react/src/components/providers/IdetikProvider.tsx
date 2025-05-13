"use client";

import { ImageSeriesLayer } from "@idetik/core";
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

// The return value of the getSnapshot() argument to useSyncExternalStore() must be memoized to
// prevent infinite rerenders.
const EMPTY_ARRAY: never[] = [];

/** Global Idetik state provider that you must wrap your application in. */
export const IdetikProvider = ({ children }: PropsWithChildren) => {
  // Global state:
  const [imageSeriesLayer, setImageSeriesLayer] = useState<
    ImageSeriesLayer | undefined
  >(undefined);
  const channels = useSyncExternalStore(
    imageSeriesLayer?.addChannelChangeCallback ?? (() => () => {}),
    () => imageSeriesLayer?.channelProps ?? EMPTY_ARRAY,
    () => EMPTY_ARRAY // Doesn't render anything on SSR
  );
  const [channelControls, setChannelControls] = useState<Array<ChannelControl>>(
    []
  );

  // Memoized callbacks:
  const clearImageSeriesLayer = useCallback(() => {
    imageSeriesLayer?.close();
    setImageSeriesLayer(undefined);
  }, [imageSeriesLayer, setImageSeriesLayer]);

  // Context value:
  const contextValue = useMemo<IdetikContextValue>(
    () =>
      imageSeriesLayer !== undefined
        ? {
            isInitialized: true,
            imageSeriesLayer,
            channels,
            channelControls,
            setImageSeriesLayer,
            clearImageSeriesLayer,
            setChannelControls,
          }
        : {
            isInitialized: false,
            setChannelControls,
            setImageSeriesLayer,
          },
    [channels, imageSeriesLayer, channelControls, clearImageSeriesLayer]
  );

  return (
    <IdetikContext.Provider value={contextValue}>
      {children}
    </IdetikContext.Provider>
  );
};
