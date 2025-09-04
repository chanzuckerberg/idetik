import { Color, ColorLike } from "@idetik/core-prerelease";

interface ColorPickerProps {
  color: ColorLike;
  onChange: (color: ColorLike) => void;
}

export function ColorPicker({ color, onChange }: ColorPickerProps) {
  return (
    <div className="flex items-center gap-sds-xxs p-sds-xxs">
      <input
        type="color"
        value={Color.from(color).rgbHex}
        onChange={(e) => onChange(Color.fromRgbHex(e.target.value))}
        className="cursor-pointer appearance-none bg-transparent border-0 p-0 m-0"
        style={{
          WebkitAppearance: "none",
          MozAppearance: "none",
        }}
      />
    </div>
  );
}
