import { InputSlider } from "@czi-sds/components";

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

  let step = (max - min) / 512.0;
  if (Number.isInteger(value[0]) && Number.isInteger(value[1])) {
    step = Math.max(1, Math.floor(step));
  }

  return (
    <InputSlider
      value={value}
      onChange={handleChange}
      min={min}
      max={max}
      step={step}
      valueLabelDisplay="auto"
      className="w-full"
    />
  );
}
