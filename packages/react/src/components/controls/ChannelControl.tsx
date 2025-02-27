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
    <div className="flex items-center gap-2">
      <VisibilityToggle visible={visible} onChange={onVisibilityChange} />
      <ColorPicker color={color} onChange={onColorChange} />
      <div className="flex-1 ml-1 mr-1 flex items-center">
        <ContrastSlider
          min={contrastRange[0]}
          max={contrastRange[1]}
          value={contrastLimits}
          onChange={onContrastChange}
        />
      </div>
      <div>{label}</div>
    </div>
  );
}
