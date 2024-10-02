import { Box } from "@mui/material";
import Renderer from "./Renderer";
import PlaybackControls from "./PlaybackControls";
import { useState } from "react";

export default function App() {
  const [curTime, setCurTime] = useState(0);
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: "1em",
      }}
    >
      <Renderer curTime={curTime}></Renderer>
      <PlaybackControls
        curTime={curTime}
        setCurTime={setCurTime}
      ></PlaybackControls>
    </Box>
  );
}
