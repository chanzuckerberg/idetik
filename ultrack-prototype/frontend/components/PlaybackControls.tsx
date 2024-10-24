import { Box } from "@mui/material";
import { Button, InputSlider } from "@czi-sds/components";
import { Dispatch, SetStateAction, useEffect, useState } from "react";

import { imageSeriesTimeInterval } from "../image_series_props";

const playbackFPS = 16;
const playbackIntervalMs = 1000 / playbackFPS;
const minTime = imageSeriesTimeInterval.start;
const maxTime = imageSeriesTimeInterval.stop - 1;
const numTimes = maxTime - minTime + 1;

type PlaybackControlsProps = {
  enabled: boolean;
  curTime: number;
  setCurTime: Dispatch<SetStateAction<number>>;
};

export default function PlaybackControls(props: PlaybackControlsProps) {
  const { enabled, curTime, setCurTime } = props;
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    console.debug("PlaybackControls::useEffect::playing: ", playing);
    if (playing) {
      const interval = setInterval(
        () =>
          setCurTime((prevCurTime) => minTime + ((prevCurTime + 1) % numTimes)),
        playbackIntervalMs
      );
      return () => clearInterval(interval);
    }
  }, [playing, setCurTime]);

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
        max={maxTime}
        disabled={!enabled}
        valueLabelDisplay="on"
        onChange={(_, value) => setCurTime(value as number)}
        value={curTime}
      />
    </Box>
  );
}
