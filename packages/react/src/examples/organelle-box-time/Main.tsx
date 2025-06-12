import React from "react";
import { createRoot } from "react-dom/client";
import cns from "classnames";

import { ThemeProvider as EmotionThemeProvider } from "@emotion/react";
import { StyledEngineProvider, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import "../../../dist";
import { Theme } from "@czi-sds/components";
import { IdetikProvider } from "index";
import App from "./App";

const domNode = document.getElementById("app")!;
const root = createRoot(domNode);

root.render(
  <React.StrictMode>
    <div className={cns("font-sds-body")}>
      <StyledEngineProvider injectFirst>
        <ThemeProvider theme={Theme("light")}>
          <EmotionThemeProvider theme={Theme("light")}>
            <CssBaseline />
            <IdetikProvider>
              <App />
            </IdetikProvider>
          </EmotionThemeProvider>
        </ThemeProvider>
      </StyledEngineProvider>
    </div>
  </React.StrictMode>
);
