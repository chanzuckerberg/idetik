import { Box, Typography } from "@mui/material";
import Task from "./Task";
import { Button } from "@czi-sds/components";
import { Dispatch, SetStateAction } from "react";

export type TaskInfo = {
  index: number;
  question: string;
  answers: string[];
  answerIndex?: number;
};

type TasksProps = {
  tasks: TaskInfo[];
  taskIndex: number;
  setTaskIndex: Dispatch<SetStateAction<number>>;
};

export default function Tasks(props: TasksProps) {
  const { tasks, taskIndex, setTaskIndex } = props;
  const numReviewed = tasks.reduce(
    (num, t) => num + (t.answerIndex === undefined ? 0 : 1),
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
        {tasks.map((t) => (
          <Task
            key={t.index}
            index={t.index}
            complete={t.answerIndex !== undefined}
            active={t.index == taskIndex}
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
          onClick={() => setTaskIndex(taskIndex - 1)}
        >
          Previous
        </Button>
        <Button
          sdsType="secondary"
          sdsStyle="square"
          disabled={taskIndex == tasks.length - 1}
          onClick={() => setTaskIndex(taskIndex + 1)}
        >
          Next
        </Button>
      </Box>
    </Box>
  );
}
