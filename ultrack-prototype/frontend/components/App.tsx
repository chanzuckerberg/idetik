import { Box } from "@mui/material";
import Renderer from "./Renderer";
import PlaybackControls from "./PlaybackControls";
import { useState } from "react";
import { imageSeriesTimeInterval } from "../image_series_props";
import TaskList from "./TaskList";
import Question from "./Question";
import { Task } from "../task";

const defaultTasks: Task[] = [];
for (let i = 0; i < 30; ++i) {
  defaultTasks.push({
    index: i,
    question: `Is this Cell Division ${i + 1}?`,
  });
}

export default function App() {
  const [playbackEnabled, setPlaybackEnabled] = useState(false);
  const [curTime, setCurTime] = useState(imageSeriesTimeInterval.start);
  const [taskIndex, setTaskIndex] = useState(0);
  const [tasks, setTasks] = useState(defaultTasks);
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
          display: "flex",
          flex: 0,
        }}
      >
        <TaskList
          tasks={tasks}
          taskIndex={taskIndex}
          setTaskIndex={setTaskIndex}
        />
      </Box>
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
        <Renderer
          playbackEnabled={playbackEnabled}
          setPlaybackEnabled={setPlaybackEnabled}
          curTime={curTime}
        ></Renderer>
        <Question
          taskIndex={taskIndex}
          tasks={tasks}
          setTasks={setTasks}
          setTaskIndex={setTaskIndex}
        ></Question>
        <PlaybackControls
          enabled={playbackEnabled}
          curTime={curTime}
          setCurTime={setCurTime}
        ></PlaybackControls>
      </Box>
    </Box>
  );
}
