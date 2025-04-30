"use client";

import { ImageLayer } from "@idetik/core";
import {
  createContext,
  PropsWithChildren,
  useContext,
  useMemo,
  useState,
} from "react";

interface IdetikContextValue {
  imageLayer: ImageLayer;
  setImageLayer: React.Dispatch<React.SetStateAction<ImageLayer | undefined>>;
}

const IdetikContext = createContext<IdetikContextValue | undefined>(undefined);

export const IdetikProvider = ({ children }: PropsWithChildren) => {
  const [imageLayer, setImageLayer] = useState<ImageLayer | undefined>(
    undefined
  );

  const contextValue = useMemo<IdetikContextValue | undefined>(() => {
    if (imageLayer !== undefined) {
      return {
        imageLayer,
        setImageLayer,
      };
    }
    return;
  }, [imageLayer]);

  return (
    <IdetikContext.Provider value={contextValue}>
      {children}
    </IdetikContext.Provider>
  );
};

/** TODO(bchu): Make more global state available via this hook. */
export function useIdetik() {
  const { imageLayer, setImageLayer } = useContext(IdetikContext);
  return {};
}
