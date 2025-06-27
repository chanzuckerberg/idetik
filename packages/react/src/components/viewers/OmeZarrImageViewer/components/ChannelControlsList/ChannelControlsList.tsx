import {
  AccordionHeader,
  AccordionDetails,
  Accordion,
  Button,
} from "@czi-sds/components";
import cns from "classnames";
import { ChannelControl } from "./components/ChannelControl";
import { ChannelProps, ColorLike, ImageSeriesLayer } from "@idetik/core";
import { useSyncExternalStore } from "react";
import { ExtraControlProps } from "../../utils";

export interface ChannelControlsListProps {
  // TODO: make this work with ImageLayer as well - need to refactor to add
  // useSyncExternalStore-compatible methods to ImageLayer
  layer: ImageSeriesLayer;
  // TODO: it's awkward to have labels and contrastRanges as separate props
  // but they're not needed for *rendering* so they don't belong in the library
  // - one option is to add a way to store related additional properties in the library
  extraControlProps: ExtraControlProps[];
  classNames?: {
    root?: string;
  };
}

export function ChannelControlsList({
  layer,
  extraControlProps,
  classNames,
}: ChannelControlsListProps) {
  const channels = useSyncExternalStore(
    (callback) => {
      layer.addChannelChangeCallback(callback);
      return () => layer.removeChannelChangeCallback(callback);
    },
    () => layer.channelProps ?? []
  );

  const updateChannel = (
    index: number,
    updates: Partial<{
      visible: boolean;
      color: ColorLike;
      contrastLimits: [number, number];
    }>
  ) => {
    const updatedChannels = [...channels];
    updatedChannels[index] = {
      ...channels[index],
      ...updates,
    };
    layer.setChannelProps(updatedChannels);
  };

  return (
    <div
      className={cns(
        "text-white",
        "bg-black/75",
        "backdrop-blur-md",
        "transition-[left]",
        "duration-300",
        "ease-in-out",
        "flex",
        "rounded-sds-m",
        "shadow-sds-m",
        "m-sds-l",
        "p-sds-xs",
        classNames?.root
      )}
    >
      <Accordion
        id="channel-controls"
        className="flex-grow"
        square
        elevation={0}
      >
        <div
          className={cns(
            "flex",
            "w-full",
            "[&_.MuiAccordionSummary-expandIconWrapper_svg]:text-white",
            "[&_.MuiAccordionSummary-expandIconWrapper_svg]:fill-white",
            "[&_.MuiAccordionSummary-root]:flex-grow"
          )}
        >
          <AccordionHeader>
            <div className={cns("flex", "items-center", "text-white")}>
              Channel Controls
            </div>
          </AccordionHeader>
        </div>

        <AccordionDetails>
          <div className={cns("grid grid-cols-4 grid-rows-auto")}>
            {channels.map((props: ChannelProps, index: number) => {
              // TODO: can possibly clean this up with better types
              // error on undefined values - we're setting defaults
              // and merging objects in too many places
              if (props.color === undefined) {
                throw new Error(`Color not defined for channel ${index}`);
              }
              if (props.contrastLimits === undefined) {
                throw new Error(
                  `Contrast limits not defined for channel ${index}`
                );
              }
              const contrastRange = extraControlProps[index].contrastRange;
              if (contrastRange === undefined) {
                throw new Error(
                  `Contrast range not defined for channel ${index}`
                );
              }

              return (
                <ChannelControl
                  key={index}
                  channelIndex={index}
                  label={extraControlProps[index].label}
                  color={props.color}
                  contrastLimits={props.contrastLimits}
                  contrastRange={contrastRange as [number, number]}
                  visible={props.visible === undefined ? true : props.visible}
                  onVisibilityChange={(visible) =>
                    updateChannel(index, { visible })
                  }
                  onColorChange={(color) => updateChannel(index, { color })}
                  onContrastChange={(contrastLimits) =>
                    updateChannel(index, { contrastLimits })
                  }
                />
              );
            })}
          </div>
          <span className={cns("flex", "justify-end", "mt-sds-xs")}>
            <Button
              sdsStyle="minimal"
              sdsType="primary"
              // Force dark mode styles on hover
              className="text-white hover:!text-white hover:!bg-dark-sds-color-semantic-base-fill-hover"
              onClick={layer.resetChannelProps.bind(layer)}
            >
              Reset channels
            </Button>
          </span>
        </AccordionDetails>
      </Accordion>
    </div>
  );
}
