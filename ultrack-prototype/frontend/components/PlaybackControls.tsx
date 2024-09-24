import { Box } from "@mui/material";
import { Button, InputSlider } from "@czi-sds/components";
import { useEffect, useState } from "react";

const playbackFPS = 16;
const playbackIntervalMs = 1000 / playbackFPS;
// Use an arbitrary number of times just to exercise playback.
const numTimes = 100;

export default function PlaybackControls() {
  const [curTime, setCurTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    console.debug("PlaybackControls::useEffect::playing: ", playing);
    if (playing) {
      const interval = setInterval(
        () => setCurTime((prevCurTime) => (prevCurTime + 1) % numTimes),
        playbackIntervalMs,
      );
      return () => clearInterval(interval);
    }
  }, [numTimes, playing]);

  return (
      <Box sx={{ 
          display: "flex",
          flexDirection: "row",
          gap: "1em",
      }}>
          <Button
              icon="Play"
              sdsSize="large"
              sdsType="primary"
              sdsStyle="icon"
              onClick={() => setPlaying(!playing)}
          />

          <InputSlider
              min={0}
              max={numTimes - 1}
              valueLabelDisplay="on"
              onChange={(_, value) => setCurTime(value as number)}
              value={curTime}
              sx={{ alignSelf: "flex-end" }}
          />
      </Box>
  );
}