import {
  AccordionHeader,
  AccordionDetails,
  Accordion,
  Button,
} from "@czi-sds/components";
import cns from "classnames";
import {
  ChannelControl,
  ChannelControlProps,
} from "./components/ChannelControl";
import { ImageSeriesLayer, ChannelProps } from "@idetik/core";
import { useEffect, useState } from "react";

interface ChannelControlsListProps {
  layer: ImageSeriesLayer;
  controlProps: Partial<ChannelControlProps>[];
  reset?: boolean;
  resetCallback?: () => Promise<void>;
}

export function ChannelControlsList({
  layer,
  controlProps,
  reset,
  resetCallback,
}: ChannelControlsListProps) {
  // Keep a local copy of channelProps to trigger re-renders
  const [channelProps, setChannelProps] = useState(layer.channelProps ?? []);

  // initial sync of local state with layer's channelProps
  useEffect(() => {
    if (reset || layer.channelProps?.length !== channelProps.length) {
      setChannelProps(layer.channelProps ?? []);
    }
  }, [layer, reset, channelProps.length]);

  // update layer's channelProps when local state changes
  useEffect(() => {
    layer.setChannelProps(channelProps);
  }, [channelProps, layer]);

  const updateChannel = (
    index: number,
    updates: Partial<{
      visible: boolean;
      color: [number, number, number];
      contrastLimits: [number, number];
    }>
  ) => {
    const updatedChannelProps = [...channelProps];

    updatedChannelProps[index] = {
      ...channelProps[index],
      ...updates,
    };

    setChannelProps(updatedChannelProps);
  };

  return (
    <div
      className={cns(
        "backdrop-blur-md",
        "transition-[left]",
        "duration-300",
        "ease-in-out",
        "flex",
        "[&_.MuiAccordion-root]:!bg-transparent",
        "[&_.MuiAccordionDetails-root]:!pb-[4px]",
        "relative",
        "before:absolute",
        "before:left-0",
        "before:top-0",
        "before:w-full",
        "before:h-full",
        "before:bg-[--sds-color-semantic-base-background-primary]",
        "before:opacity-35",
        "before:content-['']"
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
            "[&_.MuiAccordionSummary-root]:!flex-grow",
            "[&_.Mui-expanded]:!min-h-0",
            "[&_.MuiSvgIcon-root]:!fill-[--sds-color-semantic-base-text-primary]"
          )}
        >
          <AccordionHeader>
            <div className={cns("flex", "items-center")}>Channel Controls</div>
          </AccordionHeader>
        </div>

        <AccordionDetails>
          <div className={cns("grid grid-cols-4 grid-rows-auto gap-sds-xs")}>
            {channelProps.map((props: ChannelProps, index: number) => {
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
              const contrastRange = (controlProps[index]?.contrastRange ??
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
                  label={controlProps[index]?.label ?? `Channel ${index}`}
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
                sdsType="secondary"
                onClick={() => {
                  resetCallback().then(() => {
                    setChannelProps(layer.channelProps ?? []);
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
