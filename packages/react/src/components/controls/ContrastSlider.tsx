import { InputSlider } from "@czi-sds/components";

interface ContrastSliderProps {
  value: [number, number];
  onChange: (limits: [number, number]) => void;
}

export function ContrastSlider({ value, onChange }: ContrastSliderProps) {
  const handleChange = (_event: Event, newValue: number | number[]) => {
    const limits = newValue as number[];
    onChange([limits[0], limits[1]]);
  };

  return (
    <InputSlider
      value={value}
      onChange={handleChange}
      min={0}
      max={1000}
      valueLabelDisplay="auto"
      className="w-full"
    />
  );
}
