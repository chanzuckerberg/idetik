import { Box } from "@mui/material";
import { Button, InputSlider } from "@czi-sds/components";

interface PlaybackControlsProps {
    playing: boolean;
    curTime: number;
    numTimes: number;
    setPlaying: (isPlaying: boolean) => void;
    setCurTime: (curTime: number) => void;
}

export default function PlaybackControls(props: PlaybackControlsProps) {
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
                onClick={() => props.setPlaying(!props.playing)}
            />

            <InputSlider
                aria-labelledby="input-slider-time-frame"
                min={0}
                max={props.numTimes - 1}
                valueLabelDisplay="on"
                onChange={(_, value) => props.setCurTime(value as number)}
                value={props.curTime}
                sx={{ alignSelf: "flex-end" }}
            />
        </Box>
    );
}