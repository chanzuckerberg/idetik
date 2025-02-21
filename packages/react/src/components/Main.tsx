import React from "react";
import { createRoot } from "react-dom/client";
import '../index.css';

import ThemedApp from "./ThemedApp.tsx";

const domNode = document.getElementById("app")!;
const root = createRoot(domNode);

root.render(
  <React.StrictMode>
    <ThemedApp />
  </React.StrictMode>
);
