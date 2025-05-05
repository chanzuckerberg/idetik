"use client";

import { ImageSeriesLayer } from "@idetik/core";
import { PropsWithChildren, useMemo, useState } from "react";
import { IdetikContext, IdetikContextValue } from "../hooks/useIdetik";

/** Global Idetik state provider that you must wrap your application in. */
export const IdetikProvider = ({ children }: PropsWithChildren) => {
  const [imageSeriesLayer, setImageSeriesLayer] = useState<
    ImageSeriesLayer | undefined
  >(undefined);

  const contextValue = useMemo<IdetikContextValue>(
    () => ({ imageSeriesLayer, setImageSeriesLayer }),
    [imageSeriesLayer]
  );

  return (
    <IdetikContext.Provider value={contextValue}>
      {children}
    </IdetikContext.Provider>
  );
};
