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

    /**
     * Special handling for visibility toggle:
     * We need to explicitly check and flip the current visibility state because:
     * 1. React's state batching can cause stale state when updating
     * 2. Unlike color/contrast which receive new values, visibility needs to toggle existing state
     * 3. Without explicit toggle, the state would get stuck after first update
     *    because React wouldn't detect a state change
     */
    if ('visible' in updates) {
      const currentVisible = channelProps[index].visible
      updatedChannelProps[index] = {
        ...channelProps[index],
        visible: !currentVisible  // Explicitly flip the current value
      };
    } else {
      // For other updates (color, contrast), we can directly use the new values
      // since they don't depend on previous state
      updatedChannelProps[index] = {
        ...channelProps[index],
        ...updates
      };
    }

    // Update both the layer and local state to keep them in sync
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
              return (
                <ChannelControl
                  key={index}
                  channelIndex={index}
                  color={props.color}
                  contrastLimits={props.contrastLimits}
                  visible={props.visible === undefined ? true : props.visible}
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