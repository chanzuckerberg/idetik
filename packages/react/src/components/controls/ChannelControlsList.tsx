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
    initialLayerChannelProps.map(
      (layerChannel: ChannelProps, index: number) => {
        const c = controlProps[index] ?? {};
        const visible = c.visible ?? layerChannel.visible ?? true;
        const color = c.color ?? layerChannel.color;
        const contrastLimits = c.contrastLimits ?? layerChannel.contrastLimits;
        return {
          visible,
          color,
          contrastLimits,
        };
      }
    );
    setChannelProps(layer.channelProps ?? []);
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

  console.log("ChannelControlsList::render", controlProps);

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
