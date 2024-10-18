import { Button } from "@czi-sds/components";
import { Box, Typography } from "@mui/material";

export type QuestionProps = {
  question: string;
  answers: string[];
};

export default function Question(props: QuestionProps) {
  const { question, answers } = props;
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1em",
      }}
    >
      <Typography variant="h3">{question}</Typography>
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          gap: "1em",
        }}
      >
        {answers.map((answer, i) => (
          <Button key={i} sdsType="primary" sdsStyle="square">
            {answer}
          </Button>
        ))}
      </Box>
    </Box>
  );
}
