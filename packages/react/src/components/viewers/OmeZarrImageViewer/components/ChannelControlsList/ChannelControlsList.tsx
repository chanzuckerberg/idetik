import { Accordion } from "@mui/material";
import { AccordionHeader, AccordionDetails } from "@czi-sds/components";
import cns from "classnames";
import { ChannelControl, ChannelControlProps } from "./components/ChannelControl";
import { ImageLayer, ChannelProps } from "@idetik/core";
import { useState, useEffect } from "react";

interface ChannelControlsListProps {
  layer: ImageLayer;
  controlProps: Partial<ChannelControlProps>[];
}

export function ChannelControlsList({
  layer,
  controlProps,
}: ChannelControlsListProps) {
  // Keep a local copy of channelProps to trigger re-renders
  const [channelProps, setChannelProps] = useState(layer.channelProps ?? []);

  // Sync local state with layer's channelProps
  useEffect(() => {
    const initialLayerChannelProps = layer.channelProps ?? [];

    const updatedChannelProps = initialLayerChannelProps.map(
      (layerChannel: ChannelProps, index: number) => ({
        visible:
          controlProps?.[index]?.visible ?? layerChannel?.visible ?? true,
        color: controlProps?.[index]?.color ?? layerChannel?.color,
        contrastLimits:
          controlProps?.[index]?.contrastLimits ?? layerChannel?.contrastLimits,
      })
    );

    // Update both the layer and local state to keep them in sync
    // TODO: use a dispatcher?
    layer.setChannelProps(updatedChannelProps);
    setChannelProps(updatedChannelProps);
  }, [layer, controlProps]);

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

    // Update both the layer and local state to keep them in sync
    layer.setChannelProps(updatedChannelProps);
    setChannelProps(updatedChannelProps);
  };

  return (
    <div
      className={cns(
        "z-[999]",
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
        "before:opacity-50",
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
            "[&_.Mui-expanded]:!min-h-0"
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
        </AccordionDetails>
      </Accordion>
    </div>
  );
}
