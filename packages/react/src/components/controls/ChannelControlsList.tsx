import { Accordion } from "@mui/material";
import { AccordionHeader, AccordionDetails } from "@czi-sds/components";
import cns from "classnames";
import { ChannelControl } from "./ChannelControl";
import { ImageLayer, ChannelProps } from "@idetik/core";
import { useState, useEffect } from "react";

interface ChannelControlsListProps {
  layer: ImageLayer;
}

export function ChannelControlsList({ layer }: ChannelControlsListProps) {
  // Keep a local copy of channelProps to trigger re-renders
  const [channelProps, setChannelProps] = useState(layer.channelProps ?? []);

  // Sync local state with layer's channelProps
  useEffect(() => {
    setChannelProps(layer.channelProps ?? []);
  }, [layer]);

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
    <div className="sds-color-primitive-blue-400 p-1">
      <Accordion defaultExpanded id="channel-controls">
        <AccordionHeader>Channel Controls</AccordionHeader>
        <AccordionDetails>
          <div className={cns("flex flex-col gap-sds-xs")}>
            {channelProps.map((props: ChannelProps, index: number) => (
              <ChannelControl
                key={index}
                channelIndex={index}
                color={props.color}
                contrastLimits={props.contrastLimits}
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
