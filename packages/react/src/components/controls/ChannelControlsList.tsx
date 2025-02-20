import { Box, Paper, Typography, Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
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
      const currentVisible = channelProps[index].visible ?? false;
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
    <Paper sx={{ margin: 2 }}>
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Channel Controls</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {channelProps.map((props: ChannelProps, index: number) => {
              const isVisible = props.visible;
              return (
                <ChannelControl
                  key={index}
                  channelIndex={index}
                  color={props.color}
                  contrastLimits={props.contrastLimits}
                  visible={isVisible}
                  onVisibilityChange={(visible) => updateChannel(index, { visible })}
                  onColorChange={(color) => updateChannel(index, { color })}
                  onContrastChange={(contrastLimits) => updateChannel(index, { contrastLimits })}
                />
              );
            })}
          </Box>
        </AccordionDetails>
      </Accordion>
    </Paper>
  );
}