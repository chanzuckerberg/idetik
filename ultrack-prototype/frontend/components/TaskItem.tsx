import { Button, Icon } from "@czi-sds/components";
import { Dispatch, SetStateAction } from "react";
import { AnswerType, SyncStatus, TaskType } from "../lib/tasks";

function sdsIcon(answer: AnswerType) {
  switch (answer) {
    case "Yes":
      return "FlagCheck";
    case "No":
      return "FlagXMark";
    case "Uncertain":
      return "FlagQuestionMark";
  }
  return "FlagOutline";
}

function sdsIconColor(synced: SyncStatus) {
  switch (synced) {
    case "synced":
      return "blue";
    case "not_synced":
    case "pending":
      return "yellow";
    case "error":
    default:
      return "red";
  }
}

export default function TaskItem({
  index,
  answer,
  syncStatus,
  active,
  taskType,
  setTaskIndex,
}: {
  index: number;
  answer: AnswerType;
  syncStatus: SyncStatus;
  active: boolean;
  taskType: TaskType;
  setTaskIndex: Dispatch<SetStateAction<number>>;
}) {
  return (
    <Button
      endIcon={
        <Icon
          sdsIcon={sdsIcon(answer)}
          sdsType="static"
          sdsSize="s"
          color={sdsIconColor(syncStatus)}
        />
      }
      sdsType={active ? "primary" : "secondary"}
      sdsStyle="minimal"
      isAllCaps={false}
      sx={{ justifyContent: "space-between" }}
      onClick={() => setTaskIndex(index)}
    >
      {`${index + 1} Cell ${taskType}`}
    </Button>
  );
}
