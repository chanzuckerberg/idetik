import { Box } from "@mui/material";
import Renderer from "./Renderer";
import PlaybackControls from "./PlaybackControls";
import { useState } from "react";
import { imageSeriesTimeInterval } from "../image_series_props";
import Tasks from "./Tasks";
import { TaskProps } from "./Task";

const tasks: TaskProps[] = [];
tasks.push({index: 0, complete: true});
for (let i=1; i < 30; ++i) {
  tasks.push({index: i, complete: false});
}

export default function App() {
  const [playbackEnabled, setPlaybackEnabled] = useState(false);
  const [curTime, setCurTime] = useState(imageSeriesTimeInterval.start);
  return (
    <Box
      sx={{
          height: "100vh",
          display: "flex",
          flexDirection: "row",
        }}
    >
      <Box
        sx={{
          height: "100%",
          display: "flex",
          flex: 1,
          borderRight: 1,
        }}
      >
        <Tasks tasks={tasks}/>
      </Box>
      <Box
        sx={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "1em",
          overflowY: "auto",
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
