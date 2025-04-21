import { InputSlider } from "@czi-sds/components";
import { MODIFIED_SLIDER_STYLES } from "./styles";

interface ContrastSliderProps {
  value: [number, number];
  min: number;
  max: number;
  onChange: (limits: [number, number]) => void;
  disabled?: boolean;
}

export function ContrastSlider({
  min,
  max,
  value,
  onChange,
  disabled,
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
      disabled={disabled}
      {...MODIFIED_SLIDER_STYLES}
    />
  );
}
