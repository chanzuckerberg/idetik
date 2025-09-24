import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "../../src/input.css";

const domNode = document.getElementById("app")!;
const root = createRoot(domNode);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
