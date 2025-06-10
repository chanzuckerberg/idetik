import React from "react";
import { createRoot } from "react-dom/client";
import cns from "classnames";

import AppWithProviders from "./AppWithProviders";
import "../input.css";

const domNode = document.getElementById("app")!;
const root = createRoot(domNode);

root.render(
  <React.StrictMode>
    <div className={cns("font-sds-body")}>
      <AppWithProviders />
    </div>
  </React.StrictMode>
);
