import { Box } from "@mui/material";
import Renderer from "./Renderer";
import PlaybackControls from "./PlaybackControls";
import { useEffect, useState } from "react";
import TaskList from "./TaskList";
import Question from "./Question";
import { Answer, Task } from "../lib/tasks";
import { fetchTasks } from "../lib/mock_data";

export default function App() {
  const [playbackEnabled, setPlaybackEnabled] = useState(false);
  const [curTime, setCurTime] = useState(0);
  const [taskIndex, setTaskIndex] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);

  // TODO: we want to fetch new tasks more than just on mount
  // TODO: fetching and syncing might be better handled by `TaskList`
  useEffect(() => {
    const fetchOnMount = async () => {
      setTasks(await fetchTasks());
    };
    fetchOnMount();
  }, []);

  const setTaskAnswer = (answer: Answer) => {
    setTasks((prevTasks) =>
      prevTasks.map((task, index) => {
        if (index === taskIndex) {
          const newTask = task.clone();
          newTask.answer = answer;
          return newTask;
        }
        return task;
      })
    );
    setTaskIndex((prevIdx) =>
      prevIdx < tasks.length - 1 ? prevIdx + 1 : prevIdx
    );
  };

  const task = tasks[taskIndex] ?? null;
  console.debug(`App::taskIndex: ${taskIndex}/${tasks.length}, task:`, task);

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
          task={task}
          curTime={curTime}
        ></Renderer>
        <Question
          task={tasks[taskIndex]}
          setTaskAnswer={setTaskAnswer}
        ></Question>
        <PlaybackControls
          curTime={curTime}
          enabled={playbackEnabled}
          setCurTime={setCurTime}
          task={task}
        ></PlaybackControls>
      </Box>
    </Box>
  );
}
