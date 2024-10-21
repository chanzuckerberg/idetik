import { Button } from "@czi-sds/components";
import { Box, Typography } from "@mui/material";
import { TaskInfo } from "./TaskList";
import { Dispatch, SetStateAction } from "react";

export type QuestionProps = {
  taskIndex: number;
  tasks: TaskInfo[];
  setTasks: Dispatch<SetStateAction<TaskInfo[]>>;
  setTaskIndex: Dispatch<SetStateAction<number>>;
};

export default function Question(props: QuestionProps) {
  const { taskIndex, tasks, setTasks, setTaskIndex } = props;
  const task = tasks[taskIndex];

  const setAnswerIndex = (answerIndex: number) => {
    const updatedTask = structuredClone(task);
    updatedTask.answerIndex = answerIndex;
    const updatedTasks = Array(...tasks);
    updatedTasks[taskIndex] = updatedTask;
    setTasks(updatedTasks);
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1em",
      }}
    >
      <Typography variant="h3">{task.question}</Typography>
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          gap: "1em",
        }}
      >
        {task.answers.map((answer, i) => (
          <Button
            key={i}
            sdsType={task.answerIndex === i ? "primary" : "secondary"}
            sdsStyle="square"
            onClick={() => {
              setAnswerIndex(i);
              if (taskIndex < tasks.length - 1) {
                setTaskIndex(taskIndex + 1);
              }
            }}
          >
            {answer}
          </Button>
        ))}
      </Box>
    </Box>
  );
}
