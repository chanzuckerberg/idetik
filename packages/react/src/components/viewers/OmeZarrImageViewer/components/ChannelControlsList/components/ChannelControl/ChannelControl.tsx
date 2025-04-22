import { VisibilityToggle } from "./components/VisibilityToggle";
import { ColorPicker } from "./components/ColorPicker";
import { ContrastSlider } from "./components/ContrastSlider";
import { Tooltip } from "@czi-sds/components";

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
      <div className="text-right text-xs text-white font-sds-code mr-sds-s">
        {label}
      </div>
      <div className="col-span-3 flex items-center">
        <VisibilityToggle visible={visible} onChange={onVisibilityChange} />
        <ColorPicker color={color} onChange={onColorChange} />
        <Tooltip
          arrow
          sdsStyle="light"
          title="This layer is hidden"
          subtitle="Click the eye icon to enable contrast adjustment."
          placement="top"
          classes={{
            // Force dark mode theme on tooltip
            tooltip: "!bg-white !text-black [&_div]:!text-[#696969]",
            arrow: "!text-white",
          }}
          disableHoverListener={visible}
        >
          {/* https://sds.czi.design/009eaf17b/p/74af45-tooltips/t/3543fca49d */}
          <span className="flex-1 ml-[12px] mt-[5px]">
            <ContrastSlider
              min={contrastRange[0]}
              max={contrastRange[1]}
              value={contrastLimits}
              onChange={onContrastChange}
              disabled={!visible}
            />
          </span>
        </Tooltip>
      </div>
    </div>
  );
}
