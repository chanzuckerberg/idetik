import { Button } from "@czi-sds/components";
import { Box, Typography } from "@mui/material";
import { Answer, Task } from "../task";

const answers: Array<Answer> = ["Yes", "No", "Uncertain"];

export type QuestionProps = {
  task: Task;
  setTaskAnswer: (answer: Answer) => void;
};

export default function Question(props: QuestionProps) {
  const { task, setTaskAnswer } = props;

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
      <Typography variant="h3">{task.question}</Typography>
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
            sdsType={task.answer === answer ? "primary" : "secondary"}
            sdsStyle="square"
            onClick={() => setTaskAnswer(answer)}
          >
            {answer}
          </Button>
        ))}
      </Box>
    </Box>
  );
}
