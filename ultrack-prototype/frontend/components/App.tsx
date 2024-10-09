import { Box } from "@mui/material";
import Renderer from "./Renderer";
import PlaybackControls from "./PlaybackControls";
import { useState } from "react";
import { videoLayerTimeInterval } from "../video_layer_props";

export default function App() {
  const [playbackEnabled, setPlaybackEnabled] = useState(false);
  const [curTime, setCurTime] = useState(videoLayerTimeInterval.start);
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: "1em",
      }}
    >
      <Renderer
        playbackEnabled={playbackEnabled}
        setPlaybackEnabled={setPlaybackEnabled}
        curTime={curTime}>
      </Renderer>
      <PlaybackControls
        enabled={playbackEnabled}
        curTime={curTime}
        setCurTime={setCurTime}
      ></PlaybackControls>
    </Box>
  );
}
