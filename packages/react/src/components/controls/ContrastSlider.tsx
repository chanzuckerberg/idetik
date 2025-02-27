import { InputSlider } from "@czi-sds/components";

interface ContrastSliderProps {
  value: [number, number];
  min: number;
  max: number;
  onChange: (limits: [number, number]) => void;
}

export function ContrastSlider({ min, max, value, onChange }: ContrastSliderProps) {
  const handleChange = (_event: Event, newValue: number | number[]) => {
    const limits = newValue as number[];
    onChange([limits[0], limits[1]]);
  };

  return (
    <InputSlider
      value={value}
      onChange={handleChange}
      min={min}
      max={max}
      valueLabelDisplay="auto"
      className="w-full"
    />
  );
}
