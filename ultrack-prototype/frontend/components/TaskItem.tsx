import { Button, Icon } from "@czi-sds/components";
import { Dispatch, SetStateAction } from "react";
import { Answer } from "../task";

export type TaskItemProps = {
  index: number;
  answer: Answer;
  active: boolean;
  setTaskIndex: Dispatch<SetStateAction<number>>;
};

function sdsIcon(answer: Answer) {
  switch (answer) {
    case Answer.YES:
      return "FlagCheck";
    case Answer.NO:
      return "FlagXMark";
    case Answer.UNCERTAIN:
      return "FlagQuestionMark";
  }
  return "FlagOutline";
}

export default function TaskItem(props: TaskItemProps) {
  const { index, answer, active, setTaskIndex } = props;
  return (
    <Button
      endIcon={<Icon sdsIcon={sdsIcon(answer)} sdsType="static" sdsSize="s" />}
      sdsType={active ? "primary" : "secondary"}
      sdsStyle="minimal"
      isAllCaps={false}
      sx={{ justifyContent: "space-between" }}
      onClick={() => setTaskIndex(index)}
    >
      {`${index + 1} Track`}
    </Button>
  );
}
