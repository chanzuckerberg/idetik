import { Box, Typography } from "@mui/material";
import TaskItem from "./TaskItem";
import { Button } from "@czi-sds/components";
import { useEffect, Dispatch, SetStateAction } from "react";
import { Task } from "../lib/tasks";

export default function TaskList({
  tasks,
  taskIndex,
  setTaskIndex,
}: {
  tasks: Task[];
  taskIndex: number;
  setTaskIndex: Dispatch<SetStateAction<number>>;
}) {
  const numReviewed = tasks.reduce(
    (num, t) => num + (t.answer.value === "Unanswered" ? 0 : 1),
    0
  );

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

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: "1em",
      }}
    >
      <Typography variant="h3">Review Cell Divisions</Typography>
      <Typography variant="subtitle1">
        {numReviewed} of {tasks.length} annotations reviewed
      </Typography>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        {tasks.map((t, index) => (
          <TaskItem
            key={t.taskId}
            index={index}
            answer={t.answer.value}
            syncStatus={t.answer.synced}
            active={taskIndex === index}
            taskType={t.taskType}
            setTaskIndex={setTaskIndex}
          />
        ))}
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          gap: "1em",
        }}
      >
        <Button
          sdsType="secondary"
          sdsStyle="square"
          disabled={taskIndex == 0}
          onClick={() =>
            setTaskIndex((prevIndex) =>
              prevIndex > 0 ? prevIndex - 1 : prevIndex
            )
          }
        >
          Previous
        </Button>
        <Button
          sdsType="secondary"
          sdsStyle="square"
          disabled={taskIndex == tasks.length - 1}
          onClick={() =>
            setTaskIndex((prevIndex) =>
              prevIndex < tasks.length - 1 ? prevIndex + 1 : prevIndex
            )
          }
        >
          Next
        </Button>
      </Box>
    </Box>
  );
}
