import { rgbToHex, hexToRgb } from "lib/color";

interface ColorPickerProps {
  color: [number, number, number];
  onChange: (color: [number, number, number]) => void;
}

export function ColorPicker({ color, onChange }: ColorPickerProps) {

  return (
    // outer div is what is shown, because it's harder to style the input element
    <div
      className="w-6 h-6 rounded relative border hover:border-2"
      style={{
        backgroundColor: rgbToHex(color),
      }}
    >
      <input
        type="color"
        value={rgbToHex(color)}
        onChange={(e) => onChange(hexToRgb(e.target.value))}
        className="opacity-0 top-0 left-0 h-[100%] w-[100%] absolute cursor-pointer"
      />
    </div>
  );
}
