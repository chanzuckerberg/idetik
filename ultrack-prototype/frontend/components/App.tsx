import { Box, Drawer } from "@mui/material";
import Renderer from "./Renderer";
import PlaybackControls from "./PlaybackControls";
import { useState } from "react";
import { imageSeriesTimeInterval } from "../image_series_props";
import Tasks from "./Tasks";

const drawerWidth = 300;

export default function App() {
  const [playbackEnabled, setPlaybackEnabled] = useState(false);
  const [curTime, setCurTime] = useState(imageSeriesTimeInterval.start);
  return (
    <Box
      sx={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
        }}
    >
      <Drawer
        variant="permanent"
        anchor="left"
        sx={{
          "width": drawerWidth,
          "flexShrink": 0,
          "& .MuiDrawer-paper": { width: drawerWidth, boxSizing: "border-box" },
        }}
      >
        <Tasks/>
      </Drawer>
      <Box
        sx={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "1em",
        }}
      >
        <Renderer
          playbackEnabled={playbackEnabled}
          setPlaybackEnabled={setPlaybackEnabled}
          curTime={curTime}
        ></Renderer>
        <PlaybackControls
          enabled={playbackEnabled}
          curTime={curTime}
          setCurTime={setCurTime}
        ></PlaybackControls>
      </Box>
    </Box>
  );
}
