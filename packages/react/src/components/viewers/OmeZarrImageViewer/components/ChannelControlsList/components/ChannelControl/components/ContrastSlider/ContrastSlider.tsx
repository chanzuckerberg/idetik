import { InputSlider } from "@czi-sds/components";
import cns from "classnames";

interface ContrastSliderProps {
  value: [number, number];
  min: number;
  max: number;
  onChange: (limits: [number, number]) => void;
}

export function ContrastSlider({
  min,
  max,
  value,
  onChange,
}: ContrastSliderProps) {
  const handleChange = (_event: Event, newValue: number | number[]) => {
    const limits = newValue as number[];
    onChange([limits[0], limits[1]]);
  };

  const numSteps = 512;
  let step = (max - min) / numSteps;
  if (Number.isInteger(value[0]) && Number.isInteger(value[1])) {
    step = Math.max(1.0, Math.floor(step));
  }

  return (
    <InputSlider
      value={value}
      onChange={handleChange}
      min={min}
      max={max}
      step={step}
      valueLabelDisplay="auto"
      className={cns(
        // Hardcode dark mode colors to force dark mode
        // look, no matter what the theme is
        "[&_.MuiSlider-rail]:!bg-[#494949]",
        "[&_.MuiSlider-mark]:!bg-[#696969]",
        "[&_.MuiSlider-valueLabelLabel]:!text-white",
        "[&_.MuiSlider-valueLabel]:!bg-[#0D7CB5]" // This is a biohub color,
        // not sure how I can take theme variables from the actual application
        // and use them here
      )}
      sx={{
        // Hacky way to override the thumb circle color to white
        // even in dark mode.
        // Higher specificity selectors to override !important styles
        "&&& .MuiSlider-thumb": {
          "&:after": {
            backgroundColor: "#fff !important",
          },
        },
        // Alternative approach with direct element + class targeting for even higher specificity
        "span.MuiSlider-thumb": {
          "&:after": {
            backgroundColor: "#fff !important",
          },
        },
      }}
    />
  );
}
