import { Box } from "@mui/material";
import { Button, InputSlider } from "@czi-sds/components";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { Task, taskTimeInterval } from "../lib/tasks";

const playbackFPS = 16;
const playbackIntervalMs = 1000 / playbackFPS;

type PlaybackControlsProps = {
  curTime: number;
  enabled: boolean;
  setCurTime: Dispatch<SetStateAction<number>>;
  task: Task;
};

export default function PlaybackControls(props: PlaybackControlsProps) {
  const { curTime, enabled, setCurTime, task } = props;
  const [playing, setPlaying] = useState(false);

  const { start: minTime, stop: maxTime } = taskTimeInterval(task);

  useEffect(() => {
    if (!playing || !enabled) {
      return;
    }

    const interval = setInterval(() => {
      setCurTime((prevTime) => {
        const nextTime = prevTime + 1;
        if (nextTime >= maxTime) {
          return minTime;
        }
        return nextTime;
      });
    }, playbackIntervalMs);

    return () => clearInterval(interval);
  }, [enabled, maxTime, minTime, playing, setCurTime]);

  useEffect(() => {
    setCurTime(minTime);
  }, [minTime, setCurTime, task]);

  return (
    <Box
      sx={{
        display: "flex",
        flex: 0,
        flexDirection: "row",
        alignItems: "center",
        gap: "1em",
      }}
    >
      <Button
        icon="Play"
        sdsSize="large"
        sdsType="primary"
        sdsStyle="icon"
        disabled={!enabled}
        onClick={() => setPlaying(!playing)}
      />

      <InputSlider
        min={minTime}
        // the slider component is closed on the right, so we need to subtract 1
        max={maxTime - 1}
        disabled={!enabled}
        valueLabelDisplay="on"
        onChange={(_, value) => setCurTime(value as number)}
        value={curTime}
      />
    </Box>
  );
}
