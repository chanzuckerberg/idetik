import { Box, Slider } from "@mui/material";

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
    <Box sx={{ flex: 1 }}>
      <Slider
        value={value}
        onChange={handleChange}
        valueLabelDisplay="auto"
        min={0}
        max={1000}
      />
    </Box>
  );
}