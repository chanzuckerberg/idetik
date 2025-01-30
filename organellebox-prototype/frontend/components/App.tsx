import { Box } from "@mui/system";
import Renderer from "./Renderer";
// import { useEffect, useState } from "react";

export default function App() {
  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        flexDirection: "row",
        gap: "1em",
        boxSizing: "border-box",
        padding: "1em",
      }}
    >
      <Box
        sx={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          flex: 1,
          gap: "1em",
        }}
      >
        <Renderer />
      </Box>
    </Box>
  );
}
