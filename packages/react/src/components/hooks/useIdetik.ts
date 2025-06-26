import { Idetik } from "@idetik/core";
import { createContext, useContext } from "react";

export type IdetikContextValue =
  | {
      isReady: true;
      canvas: HTMLCanvasElement;
      runtime: Idetik;
    }
  | {
      isReady: false;
      initializeWithCanvas: (canvas: HTMLCanvasElement) => void;
    };

export const IdetikContext = createContext<IdetikContextValue | undefined>(
  undefined
);

/** Gives you access to Idetik global state to write our own custom components. */
export function useIdetik(): IdetikContextValue {
  const contextValue = useContext(IdetikContext);
  if (!contextValue) {
    throw new Error("useIdetik must be used within an IdetikProvider");
  }
  return contextValue;
}
