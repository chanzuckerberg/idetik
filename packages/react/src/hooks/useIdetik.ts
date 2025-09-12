import { Idetik } from "@idetik/core-prerelease";
import { createContext, useContext } from "react";

export type IdetikContextValue = {
  runtime: Idetik | null;
  canvasRefCallback(canvas: HTMLCanvasElement | null): void;
};

export const IdetikContext = createContext<IdetikContextValue | undefined>(
  undefined
);

/** Gives access to Idetik global state to write our own custom components. */
export function useIdetik(): IdetikContextValue {
  const contextValue = useContext(IdetikContext);
  if (contextValue === undefined) {
    throw new Error("You must wrap your application in <IdetikProvider>.");
  }
  return contextValue;
}
