import React, { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { IdetikProvider } from "../../src/components/providers/IdetikProvider";

/**
 * Custom render function that wraps components with IdetikProvider
 */
export function renderWithProvider(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <IdetikProvider>{children}</IdetikProvider>;
  }

  return render(ui, { wrapper: Wrapper, ...options });
}
