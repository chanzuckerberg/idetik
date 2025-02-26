import { hexToRgb } from "lib/color";

interface ColorPickerProps {
  color: [number, number, number];
  onChange: (color: [number, number, number]) => void;
}

export function ColorPicker({ color, onChange }: ColorPickerProps) {
  // Convert RGB [0-1] values to hex string
  const rgbToHex = (rgb: [number, number, number]) => {
    const toHex = (n: number) => {
      const hex = Math.round(n * 255).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    };
    return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
  };

  return (
    <div className="flex items-center gap-2 rounded p-2">
      <input
        type="color"
        value={rgbToHex(color)}
        onChange={(e) => onChange(hexToRgb(e.target.value))}
        className="w-8 h-8 rounded border-none bg-transparent appearance-none cursor-pointer"
      />
    </div>
  );
}
