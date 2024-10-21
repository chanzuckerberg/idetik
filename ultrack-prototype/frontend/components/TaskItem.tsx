import { InputCheckbox } from "@czi-sds/components";
import { Box } from "@mui/material";
import { Dispatch, SetStateAction } from "react";

export type TaskItemProps = {
  index: number;
  complete: boolean;
  active: boolean;
  setTaskIndex: Dispatch<SetStateAction<number>>;
};

export default function TaskItem(props: TaskItemProps) {
  const { index, complete, active, setTaskIndex } = props;
  return (
    <Box
      sx={{
        backgroundColor: active ? "#cccccc" : null,
      }}
    >
      <InputCheckbox
        label={index + 1 + " Track"}
        stage={complete ? "checked" : "unchecked"}
        disabled={complete}
        onClick={() => setTaskIndex(index)}
      />
    </Box>
  );
}
