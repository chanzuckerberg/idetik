import { VisibilityToggle } from "./components/VisibilityToggle";
import { ColorPicker } from "./components/ColorPicker";
import { ContrastSlider } from "./components/ContrastSlider";

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
    <div className="grid grid-cols-subgrid col-start-1 col-end-5 items-center">
      <div className="text-right text-xs text-white font-sds-code">{label}</div>
      <div className="col-span-3 flex items-center">
        <VisibilityToggle visible={visible} onChange={onVisibilityChange} />
        <ColorPicker color={color} onChange={onColorChange} />
        <div className="flex-1 mx-[7px] mt-[5px]">
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
