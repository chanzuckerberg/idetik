import { VisibilityToggle } from "./VisibilityToggle";
import { ColorPicker } from "./ColorPicker";
import { ContrastSlider } from "./ContrastSlider";

interface ChannelControlProps {
  channelIndex: number;
  color: [number, number, number];
  contrastLimits: [number, number];
  visible: boolean;
  onVisibilityChange: (visible: boolean) => void;
  onContrastChange: (limits: [number, number]) => void;
  onColorChange: (color: [number, number, number]) => void;
}

export function ChannelControl({
  color,
  contrastLimits,
  visible,
  onVisibilityChange,
  onContrastChange,
  onColorChange,
}: ChannelControlProps) {
  return (
    <div className="test-style m-8 p-8 bg-purple-500">
      <VisibilityToggle visible={visible} onChange={onVisibilityChange} />
      <ColorPicker color={color} onChange={onColorChange} />
      <ContrastSlider value={contrastLimits} onChange={onContrastChange} />
    </div>
  );
}