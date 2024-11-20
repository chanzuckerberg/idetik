import { Button } from "@czi-sds/components";
import { Box, Typography } from "@mui/material";
import { AnswerType, Task } from "../lib/tasks";

const answers: AnswerType[] = ["Yes", "No", "Uncertain"];

export type QuestionProps = {
  disabled: boolean;
  task: Task | null;
  setTaskAnswer: (answer: AnswerType) => void;
};

export default function Question(props: QuestionProps) {
  const { disabled, task, setTaskAnswer } = props;

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
            key={answer}
            sdsType={task?.answer.value === answer ? "primary" : "secondary"}
            sdsStyle="square"
            onClick={() => setTaskAnswer(answer)}
            disabled={disabled}
          >
            {answer}
          </Button>
        ))}
      </Box>
    </Box>
  );
}
