import { Accordion } from "@mui/material";
import { AccordionHeader, AccordionDetails } from "@czi-sds/components";
import cns from "classnames";
import { ChannelControl, ChannelControlProps } from "./ChannelControl";
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
    <div className="text-white z-[999] bg-black/20 backdrop-blur-md transition-[left] duration-300 ease-in-out flex [&_.MuiAccordion-root]:!bg-transparent [&_.MuiAccordionDetails-root]:!pb-[4px]">
      <Accordion
        defaultExpanded
        id="channel-controls"
        className="flex-grow"
        square
        elevation={0}
      >
        <div
          className={cns(
            "flex w-full [&_.MuiAccordionSummary-expandIconWrapper_svg]:!text-white [&_.MuiAccordionSummary-expandIconWrapper_svg]:!fill-white [&_.MuiAccordionSummary-root]:!flex-grow [&_.Mui-expanded]:!min-h-0"
          )}
        >
          <AccordionHeader>
            <div className={cns("flex items-center")}>
              <span className={cns("text-white")}>Channel Controls</span>
            </div>
          </AccordionHeader>
        </div>

        <AccordionDetails>
          <div className={cns("flex flex-col")}>
            {channelProps.map((props: ChannelProps, index: number) => (
              <ChannelControl
                key={index}
                channelIndex={index}
                label={controlProps[index]?.label ?? `Channel ${index}`}
                color={props.color}
                contrastLimits={props.contrastLimits}
                contrastRange={
                  controlProps[index]?.contrastRange ?? props.contrastLimits
                }
                visible={props.visible === undefined ? true : props.visible}
                onVisibilityChange={(visible) =>
                  updateChannel(index, { visible })
                }
                onColorChange={(color) => updateChannel(index, { color })}
                onContrastChange={(contrastLimits) =>
                  updateChannel(index, { contrastLimits })
                }
              />
            ))}
          </div>
        </AccordionDetails>
      </Accordion>
    </div>
  );
}
