import React from "react";
import { createRoot } from "react-dom/client";
import cns from "classnames";

import AppWithProviders from "../../src/components/AppWithProviders";
import "../../dist";
import App from "./App";
import "../../src/input.css";

const domNode = document.getElementById("app")!;
const root = createRoot(domNode);

root.render(
  <React.StrictMode>
    <div className={cns("font-sds-body")}>
      <AppWithProviders>
        <App />
      </AppWithProviders>
    </div>
  </React.StrictMode>
);
