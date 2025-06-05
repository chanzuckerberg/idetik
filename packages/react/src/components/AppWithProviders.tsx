import { ThemeProvider as EmotionThemeProvider } from "@emotion/react";
import { StyledEngineProvider, ThemeProvider } from "@mui/material/styles";
import { Theme } from "@czi-sds/components";
import CssBaseline from "@mui/material/CssBaseline";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useRef } from "react";

import App from "./App";
import { IdetikProvider } from "./providers/IdetikProvider";

// Create a wrapper component to handle providers
export default function AppWithProviders() {
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const theme = prefersDarkMode ? Theme("dark") : Theme("light");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <EmotionThemeProvider theme={theme}>
          <CssBaseline />
          <IdetikProvider canvasRef={canvasRef}>
            <App canvasRef={canvasRef} />
          </IdetikProvider>
        </EmotionThemeProvider>
      </ThemeProvider>
    </StyledEngineProvider>
  );
}
