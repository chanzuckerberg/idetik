import { Button, InputSlider } from "@czi-sds/components";
import { Box, Typography } from "@mui/material";

type ContrastLimits = {
  min: number;
  start: number;
  stop: number;
  max: number;
  step: number;
};

// TODO: name clash with library's channel props.
// These should probably just be equivalent.
export type ChannelProps = {
  name: string;
  visible: boolean;
  contrastLimits: ContrastLimits;
};

export type ChannelArgs = {
  name: string;
  visible: boolean;
  contrastLimits: ContrastLimits;
  onChange(props: ChannelProps): void;
};

export default function Channel(props: ChannelArgs) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        width: "100%",
        alignItems: "center",
        gap: "1em",
      }}
    >
      <Typography variant="body1">{props.name}</Typography>
      <InputSlider
        value={[props.contrastLimits.start, props.contrastLimits.stop]}
        min={props.contrastLimits.min}
        max={props.contrastLimits.max}
        step={props.contrastLimits.step}
        marks={true}
        valueLabelDisplay="auto"
        onChange={(_, value) => {
          if (Array.isArray(value)) {
            props.onChange({
              name: props.name,
              visible: props.visible,
              contrastLimits: {
                ...props.contrastLimits,
                start: value[0],
                stop: value[1],
              },
            });
          }
        }}
      />
      <Button
        icon={props.visible ? "EyeOpen" : "EyeClosed"}
        sdsStyle="icon"
        sdsSize="small"
        onClick={() => {
          props.onChange({
            name: props.name,
            visible: !props.visible,
            contrastLimits: props.contrastLimits,
          });
        }}
      />
    </Box>
  );
}
