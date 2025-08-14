import React from "react";
import { createRoot } from "react-dom/client";

import ThemedApp from "./ThemedApp";

const domNode = document.getElementById("app")!;
const root = createRoot(domNode);

root.render(
  <React.StrictMode>
    <ThemedApp />
  </React.StrictMode>
);
