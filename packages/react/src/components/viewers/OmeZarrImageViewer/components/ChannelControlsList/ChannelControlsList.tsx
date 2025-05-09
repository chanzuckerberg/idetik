"use client";

import {
  AccordionHeader,
  AccordionDetails,
  Accordion,
  Button,
} from "@czi-sds/components";
import cns from "classnames";
import { ChannelControl } from "./components/ChannelControl";
import { ChannelProps } from "@idetik/core";
import { useIdetik } from "components/hooks";

export interface ChannelControlsListProps {
  classNames?: {
    root?: string;
  };
}

export function ChannelControlsList({ classNames }: ChannelControlsListProps) {
  const {
    isInitialized,
    channels,
    setChannels,
    resetChannels,
    channelControls,
  } = useIdetik();

  const updateChannel = (
    index: number,
    updates: Partial<{
      visible: boolean;
      color: [number, number, number];
      contrastLimits: [number, number];
    }>
  ) => {
    const updatedChannels = [...channels];
    updatedChannels[index] = {
      ...channels[index],
      ...updates,
    };
    setChannels(updatedChannels);
  };

  if (!isInitialized) {
    return null;
  }

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
              const contrastRange = (channelControls[index]?.contrastRange ??
                props.contrastLimits)!;
              if (contrastRange === undefined) {
                throw new Error(
                  `Contrast range not defined for channel ${index}`
                );
              }

              return (
                <ChannelControl
                  key={index}
                  channelIndex={index}
                  label={channelControls[index]?.label ?? `Channel ${index}`}
                  color={props.color}
                  contrastLimits={props.contrastLimits}
                  contrastRange={contrastRange}
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
              onClick={() => {
                resetChannels();
              }}
            >
              Reset channels
            </Button>
          </span>
        </AccordionDetails>
      </Accordion>
    </div>
  );
}
