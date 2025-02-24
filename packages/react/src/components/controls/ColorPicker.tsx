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

  // Convert hex string to RGB [0-1] values
  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return [0, 0, 0];
    return [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255,
    ];
  };

  return (
    <div className="flex items-center gap-2 bg-sds-gray-50 rounded p-2">
      <input
        type="color"
        value={rgbToHex(color)}
        onChange={(e) => onChange(hexToRgb(e.target.value))}
        className="w-8 h-8 rounded cursor-pointer hover:ring-2 hover:ring-sds-gray-200"
      />
    </div>
  );
}
