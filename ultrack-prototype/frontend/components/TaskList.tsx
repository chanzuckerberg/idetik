import { Box, Typography } from "@mui/material";
import TaskItem from "./TaskItem";
import { Button } from "@czi-sds/components";
import { Dispatch, SetStateAction } from "react";
import { Task } from "../lib/tasks";

type TaskListProps = {
  tasks: Task[];
  taskIndex: number;
  setTaskIndex: Dispatch<SetStateAction<number>>;
};

export default function TaskList(props: TaskListProps) {
  const { tasks, taskIndex, setTaskIndex } = props;
  const numReviewed = tasks.reduce(
    (num, t) => num + (t.answer === undefined ? 0 : 1),
    0
  );
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
            key={t.task_id}
            index={index}
            answer={t.answer}
            active={taskIndex === index}
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
