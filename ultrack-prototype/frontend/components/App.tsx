import { Box } from "@mui/material";
import Renderer from "./Renderer";
import PlaybackControls from "./PlaybackControls";
import { useEffect, useState } from "react";
import TaskList from "./TaskList";
import Question from "./Question";
import { AnswerType, Task } from "../lib/tasks";
import {
  fetchTasks as fetchMockTasks,
  postAnswers as postMockAnswers,
} from "../lib/mock_data";
import {
  fetchTasks as fetchRealTasks,
  postAnswers as postRealAnswers,
} from "../lib/data";

let fetchTasks = fetchRealTasks;
let postAnswers = postRealAnswers;

if (import.meta.env.VITE_MOCK_ULTRACK === "true") {
  fetchTasks = fetchMockTasks;
  postAnswers = postMockAnswers;
}

export default function App() {
  const [playbackEnabled, setPlaybackEnabled] = useState(false);
  const [curTime, setCurTime] = useState(0);
  const [taskIndex, setTaskIndex] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);

  // TODO: we want to fetch new tasks more than just on mount
  // TODO: fetching and syncing might be better handled by `TaskList`
  // TODO: fetch the latest answers as well? this would require some session ID
  useEffect(() => {
    const fetchOnMount = async () => {
      const tasks = await fetchTasks();
      console.debug("App::fetched tasks", tasks);
      setTasks(tasks);
    };
    fetchOnMount();
  }, []);

  const task = tasks[taskIndex] ?? null;
  console.debug(`App::taskIndex: ${taskIndex}/${tasks.length}, task:`, task);

  const setTaskAnswer = (answer: AnswerType) => {
    setTasks((prevTasks) =>
      prevTasks.map((task, index) => {
        if (index === taskIndex) {
          const newTask = task.clone();
          newTask.answer.value = answer;
          newTask.answer.synced = "not_synced";
          return newTask;
        }
        return task;
      })
    );
    setTaskIndex((prevIdx) =>
      prevIdx < tasks.length - 1 ? prevIdx + 1 : prevIdx
    );
  };

  useEffect(() => {
    const answersToSync = tasks
      .map((task) => task.answer)
      .filter((answer) => answer.synced === "not_synced");

    if (answersToSync.length === 0) {
      return;
    }

    const setPending = () => {
      setTasks((prevTasks) =>
        prevTasks.map((task) => {
          if (task.answer.synced === "not_synced") {
            const newTask = task.clone();
            newTask.answer.synced = "pending";
            return newTask;
          }
          return task;
        })
      );
    };
    setPending();

    const postAnswersToSync = async () => {
      const synced = await postAnswers(answersToSync);
      setTasks((prevTasks) =>
        prevTasks.map((task) => {
          const syncedAnswer = synced.find((a) => a.taskId === task.taskId);
          if (syncedAnswer) {
            const newTask = task.clone();
            newTask.answer.synced = syncedAnswer.synced;
            return newTask;
          }
          return task;
        })
      );
    };
    postAnswersToSync();
  }, [tasks, setTasks]);

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
          disabled={!playbackEnabled}
          task={task}
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
