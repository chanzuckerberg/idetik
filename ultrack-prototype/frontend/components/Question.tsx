import { Button } from "@czi-sds/components";
import { Box, Typography } from "@mui/material";
import { AnswerType, Task } from "../lib/tasks";
import { useEffect } from "react";

type Answer = {
  type: AnswerType;
  shortcut: string;
};

// Shortcuts "1", "2", and "3" are used to be ergonomic on most
// keyboard layouts and to be consistent with Ultrack's napari plugin:
// https://github.com/royerlab/ultrack/blob/ff3bf242e395bde3236153317802b5aff8dbb6a6/ultrack/validation/link_validation.py#L159
const answers: Answer[] = [
  { type: "Yes", shortcut: "1" },
  { type: "No", shortcut: "2" },
  { type: "Uncertain", shortcut: "3" },
];

export type QuestionProps = {
  disabled: boolean;
  task: Task | null;
  setTaskAnswer: (answer: AnswerType) => void;
};

export default function Question(props: QuestionProps) {
  const { disabled, task, setTaskAnswer } = props;

  useEffect(() => {
    const selectAnswer = (event: KeyboardEvent) => {
      const answer = answers.find(
        (answer: Answer) => answer.shortcut === event.key
      );
      if (answer !== undefined) {
        setTaskAnswer(answer.type);
      }
    };
    document.addEventListener("keydown", selectAnswer);
    return () => {
      document.removeEventListener("keydown", selectAnswer);
    };
  }, [setTaskAnswer]);

  return (
    <Box
      sx={{
        display: "flex",
        flex: 0,
        flexDirection: "column",
        alignItems: "center",
        gap: "1em",
      }}
    >
      <Typography variant="h3">{task?.question ?? ""}</Typography>
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          gap: "1em",
        }}
      >
        {answers.map((answer) => (
          <Button
            key={answer.type}
            sdsType={
              task?.answer.value === answer.type ? "primary" : "secondary"
            }
            sdsStyle="square"
            onClick={() => setTaskAnswer(answer.type)}
            disabled={disabled}
          >
            {answer.type} ({answer.shortcut})
          </Button>
        ))}
      </Box>
    </Box>
  );
}
