import React from "react";
import { createRoot } from "react-dom/client";
import cns from "classnames";

import ThemedApp from "./ThemedApp.tsx";
import "../index.css";

const domNode = document.getElementById("app")!;
const root = createRoot(domNode);

root.render(
  <React.StrictMode>
    <div className={cns("font-sds-body", "min-w-[1024px]")}>
      <ThemedApp />
    </div>
  </React.StrictMode>
);
