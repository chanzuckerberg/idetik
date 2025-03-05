import { VisibilityToggle } from "./VisibilityToggle";
import { ColorPicker } from "./ColorPicker";
import { ContrastSlider } from "./ContrastSlider";

export interface ChannelControlProps {
  channelIndex: number;
  label: string;
  color: [number, number, number];
  contrastLimits: [number, number];
  contrastRange: [number, number];
  visible: boolean;
  onVisibilityChange: (visible: boolean) => void;
  onContrastChange: (limits: [number, number]) => void;
  onColorChange: (color: [number, number, number]) => void;
}

export function ChannelControl({
  label,
  color,
  contrastLimits,
  contrastRange,
  visible,
  onVisibilityChange,
  onContrastChange,
  onColorChange,
}: ChannelControlProps) {
  return (
    <div className="grid grid-cols-[minmax(70px,auto)_auto_auto_1fr] items-center gap-sds-xs py-sds-xxxs">
      <div className="text-xs text-white truncate">{label}</div>
      <div className="flex justify-center">
        <VisibilityToggle visible={visible} onChange={onVisibilityChange} />
      </div>
      <div className="flex justify-center">
        <ColorPicker color={color} onChange={onColorChange} />
      </div>
      <ContrastSlider
        min={contrastRange[0]}
        max={contrastRange[1]}
        value={contrastLimits}
        onChange={onContrastChange}
      />
    </div>
  );
}
