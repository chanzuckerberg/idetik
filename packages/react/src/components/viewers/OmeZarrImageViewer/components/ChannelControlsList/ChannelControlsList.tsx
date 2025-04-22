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
import { useEffect, useRef, useState } from "react";

interface ChannelControlsListProps {
  layer: ImageSeriesLayer;
  controlProps: Partial<ChannelControlProps>[];
  resetCallback?: () => Promise<void>;
}

export function ChannelControlsList({
  layer,
  controlProps,
  resetCallback,
}: ChannelControlsListProps) {
  // Keep a local copy of channelProps to trigger re-renders
  const [channelProps, setChannelProps] = useState(layer.channelProps ?? []);
  const isInternalUpdate = useRef(false);

  // initial sync of local state with layer's channelProps
  // props change indicates this is not an internal update
  useEffect(() => {
    isInternalUpdate.current = false;
    setChannelProps(layer.channelProps ?? []);
  }, [layer, controlProps, resetCallback]);

  // update layer's channelProps when local state changes
  useEffect(() => {
    if (isInternalUpdate.current) {
      layer.setChannelProps(channelProps);
    }
  }, [channelProps, layer]);

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
        "shadow-sds-m",
        "m-0",
        "md:m-sds-l",
        "p-0",
        "md:p-sds-xs",
        "rounded-none",
        "md:rounded-sds-m"
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
          <div
            className={cns(
              // The negative margins make the controls more compact on mobile,
              // so we show more of the image
              "grid grid-cols-4 grid-rows-auto -my-sds-xs md:my-0 [&>*]:-my-sds-m md:[&>*]:my-0"
            )}
          >
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
                sdsType="primary"
                // Force dark mode styles on hover
                className="text-white hover:!text-white hover:!bg-dark-sds-color-semantic-base-fill-hover"
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
