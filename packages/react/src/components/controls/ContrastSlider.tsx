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

  return (
    <div className="flex justify-center">
      <InputSlider
        value={value}
        onChange={handleChange}
        min={min}
        max={max}
        valueLabelDisplay="auto"
        className={cns(
          // Hardcode dark mode colors to force dark mode
          // look, no matter what the theme is
          "[&_.MuiSlider-rail]:!bg-[#494949]",
          "[&_.MuiSlider-track]:!bg-[#0D7CB5]",
          "[&_.MuiSlider-mark]:!bg-[#696969]",
          "[&_.MuiSlider-thumb]:after:!bg-[#101010]",
          "[&_.MuiSlider-valueLabel]:!bg-[#065B86]",
          "[&_.MuiSlider-valueLabelLabel]:!text-white"
        )}
      />
    </div>
  );
}
