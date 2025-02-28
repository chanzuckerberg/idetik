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
  // remove prefix (number + hyphen) from label if present
  label = label.replace(/^\d+-/, "");
  return (
    <div className="grid grid-cols-subgrid col-start-1 col-end-5 gap-2 items-center">
      <div className="text-right text-xs">{label}</div>
      <div className="col-span-3 flex items-center gap-2">
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
      </div>
    </div>
  );
}
