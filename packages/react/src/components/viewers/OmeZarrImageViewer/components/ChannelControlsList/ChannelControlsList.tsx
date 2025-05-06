import {
  AccordionHeader,
  AccordionDetails,
  Accordion,
  Button,
} from "@czi-sds/components";
import cns from "classnames";
import { ChannelControl } from "./components/ChannelControl";
import { ChannelProps } from "@idetik/core";
import { useEffect, useRef, useState } from "react";
import { useIdetik } from "components/hooks";

interface ChannelControlsListProps {
  resetCallback?: () => Promise<void>;
}

export function ChannelControlsList({
  resetCallback,
}: ChannelControlsListProps) {
  const { channels, setChannels, channelControls } = useIdetik();

  // Keep a local copy of channelProps to trigger re-renders
  const [channelProps, setChannelProps] = useState(channels ?? []);
  const isInternalUpdate = useRef(false);

  // initial sync of local state with layer's channelProps
  // props change indicates this is not an internal update
  useEffect(() => {
    isInternalUpdate.current = false;
    setChannelProps(channels ?? []);
  }, [channels, resetCallback]);

  // update layer's channelProps when local state changes
  useEffect(() => {
    if (isInternalUpdate.current) {
      setChannels(channelProps);
    }
  }, [channelProps, setChannels]);

  const updateChannel = (
    index: number,
    updates: Partial<{
      visible: boolean;
      color: [number, number, number];
      contrastLimits: [number, number];
    }>
  ) => {
    isInternalUpdate.current = true;
    const updatedChannelProps = [...channelProps];

    updatedChannelProps[index] = {
      ...channelProps[index],
      ...updates,
    };

    setChannelProps(updatedChannelProps);
  };

  // ImageSeriesLayer has not been initialized.
  if (channels === undefined || channelControls === undefined) {
    return null;
  }

  // const resetCallback = useCallback(async () => {
  //   if (!source || !imageLayer) return;
  //   const omeroChannels = await loadOmeroChannels(sourceUrl);
  //   imageLayer.setChannelProps(omeroToChannelProps(omeroChannels));
  //   setChannelControls(omeroToChannelControls(omeroChannels));
  // }, [source, sourceUrl, imageLayer, setChannelControls]);

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
        "p-sds-xs"
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
          {resetCallback && (
            <span className={cns("flex", "justify-end", "mt-sds-xs")}>
              <Button
                sdsStyle="minimal"
                sdsType="primary"
                // Force dark mode styles on hover
                className="text-white hover:!text-white hover:!bg-dark-sds-color-semantic-base-fill-hover"
                onClick={() => {
                  resetCallback().then(() => {
                    setChannelProps(channels ?? []);
                  });
                }}
              >
                Reset channels
              </Button>
            </span>
          )}
        </AccordionDetails>
      </Accordion>
    </div>
  );
}
