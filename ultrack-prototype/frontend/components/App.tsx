import { Box } from "@mui/material";
import Renderer from "./Renderer";
import PlaybackControls from "./PlaybackControls";
import { useCallback, useEffect, useState } from "react";
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
  useEffect(() => {
    const fetchOnMount = async () => {
      setTasks(await fetchTasks());
    };
    fetchOnMount();
  }, []);

  const setTaskAnswer = useCallback(
    (answer: Answer) => {
      tasks[taskIndex].answer = answer;
      setTasks([...tasks]);
      setTaskIndex((prevIndex) =>
        prevIndex < tasks.length - 1 ? prevIndex + 1 : prevIndex
      );
    },
    [tasks, setTasks, taskIndex, setTaskIndex]
  );

  // TODO: task navigation can be owned by the task list component
  useEffect(() => {
    const navigateTask = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        setTaskIndex((prevTask) => Math.min(prevTask + 1, tasks.length - 1));
      } else if (event.key === "ArrowUp") {
        setTaskIndex((prevTask) => Math.max(prevTask - 1, 0));
      }
    };
    document.addEventListener("keydown", navigateTask);

    return () => {
      document.removeEventListener("keydown", navigateTask);
    };
  }, [tasks, setTaskIndex]);

  // TODO: make task explicitly nullable, or handle a null task here (instead of in child components)
  const task = tasks[taskIndex];
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
