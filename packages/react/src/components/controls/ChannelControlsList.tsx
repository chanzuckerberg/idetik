import { Accordion, AccordionHeader, AccordionDetails } from "@czi-sds/components";
import { ChannelControl } from "./ChannelControl";
import { ImageLayer, ChannelProps } from "@idetik/core";
import { useState, useEffect } from 'react';

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

  const updateChannel = (index: number, updates: Partial<{
    visible: boolean;
    color: [number, number, number];
    contrastLimits: [number, number];
  }>) => {
    const updatedChannelProps = [...channelProps];

    // For visibility updates, explicitly toggle the current value
    if ('visible' in updates) {
      const currentVisible = channelProps[index].visible
      updatedChannelProps[index] = {
        ...channelProps[index],
        visible: !currentVisible
      };
    } else {
      updatedChannelProps[index] = {
        ...channelProps[index],
        ...updates
      };
    }

    // Update both the layer and local state
    layer.setChannelProps(updatedChannelProps);
    setChannelProps(updatedChannelProps);
  };

  return (
    <div>
      <Accordion defaultExpanded id="channel-controls">
        <div className="flex w-full">
          <AccordionHeader>
            <div className="flex items-center">
              <span className="font-sds-body">
                Channel Controls
              </span>
            </div>
          </AccordionHeader>
        </div>

        <AccordionDetails>
          <div className="flex flex-col gap-sds-m">
            {channelProps.map((props: ChannelProps, index: number) => (
              <ChannelControl
                key={index}
                channelIndex={index}
                color={props.color}
                contrastLimits={props.contrastLimits}
                visible={props.visible}
                onVisibilityChange={(visible) => updateChannel(index, { visible })}
                onColorChange={(color) => updateChannel(index, { color })}
                onContrastChange={(contrastLimits) => updateChannel(index, { contrastLimits })}
              />
            ))}
          </div>
        </AccordionDetails>
      </Accordion>
    </div>
  );
}