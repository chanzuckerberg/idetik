import { rgbToHex, hexToRgb } from "lib/color";

interface ColorPickerProps {
  color: [number, number, number];
  onChange: (color: [number, number, number]) => void;
}

export function ColorPicker({ color, onChange }: ColorPickerProps) {
  return (
    // outer div is what is shown, because it's harder to style the input element
    <div className="flex items-center gap-sds-xxs p-sds-xxs">
      <input
        type="color"
        value={rgbToHex(color)}
        onChange={(e) => onChange(hexToRgb(e.target.value))}
        className="cursor-pointer appearance-none bg-transparent border-0 p-0 m-0"
        style={{
          WebkitAppearance: "none",
          MozAppearance: "none",
        }}
      />
    </div>
  );
}
