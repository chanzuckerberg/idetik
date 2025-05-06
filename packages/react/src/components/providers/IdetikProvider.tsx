"use client";

import { ImageSeriesLayer } from "@idetik/core";
import { PropsWithChildren, useMemo, useState } from "react";
import {
  ChannelControl,
  IdetikContext,
  IdetikContextValue,
} from "../hooks/useIdetik";

/** Global Idetik state provider that you must wrap your application in. */
export const IdetikProvider = ({ children }: PropsWithChildren) => {
  const [imageSeriesLayer, setImageSeriesLayer] = useState<
    ImageSeriesLayer | undefined
  >(undefined);
  const [channelControls, setChannelControls] = useState<
    Array<ChannelControl> | undefined
  >(undefined);

  const contextValue = useMemo<IdetikContextValue>(
    () => ({
      imageSeriesLayer,
      setImageSeriesLayer,
      channelControls,
      setChannelControls,
    }),
    [imageSeriesLayer, channelControls]
  );

  return (
    <IdetikContext.Provider value={contextValue}>
      {children}
    </IdetikContext.Provider>
  );
};
