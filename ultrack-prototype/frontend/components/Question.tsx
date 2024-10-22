import { Button } from "@czi-sds/components";
import { Box, Typography } from "@mui/material";
import { Answer, Task } from "../task";
import { Dispatch, SetStateAction } from "react";

export type QuestionProps = {
  taskIndex: number;
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  setTaskIndex: Dispatch<SetStateAction<number>>;
};

export default function Question(props: QuestionProps) {
  const { taskIndex, tasks, setTasks, setTaskIndex } = props;
  const task = tasks[taskIndex];

  const setAnswer = (answer: Answer) => {
    const updatedTask = structuredClone(task);
    updatedTask.answer = answer;
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
        {Object.entries(Answer).map(([answer, label]) => (
          <Button
            key={answer}
            sdsType={task.answer === answer ? "primary" : "secondary"}
            sdsStyle="square"
            onClick={() => {
              const key = answer as keyof typeof Answer;
              setAnswer(Answer[key]);
              setTaskIndex((prevIndex) =>
                prevIndex < tasks.length - 1 ? prevIndex + 1 : prevIndex
              );
            }}
          >
            {label}
          </Button>
        ))}
      </Box>
    </Box>
  );
}
