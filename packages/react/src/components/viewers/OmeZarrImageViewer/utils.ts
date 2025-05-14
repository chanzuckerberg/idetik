import { OmeroChannel, ChannelProps } from "@idetik/core";
import { hexToRgb } from "lib/color";
import { ChannelControl } from "../../hooks/useIdetik";

// TODO: the limits/range from the omero channels should possibly be reversed
// (start/end for limits, min/max for range) but the organelle box data works better this way
// TODO: provide a way to get our own limits automatically from the data instead of the metadata
export const omeroToChannelProps = (
  omeroChannels: OmeroChannel[]
): ChannelProps[] => {
  return omeroChannels.map((channel) => {
    const { start, end, min, max } = channel.window;
    return {
      visible: channel.active,
      color: hexToRgb(channel.color),
      contrastLimits: [Math.max(start, min), Math.min(end, max)],
    };
  });
};

export const omeroToChannelControls = (
  omeroChannels: OmeroChannel[]
): ChannelControl[] => {
  return omeroChannels.map((channel, index) => {
    // remove prefix (number + hyphen) from label if present (seen in organelle box data)
    const label = (channel.label ?? `Ch${index}`).replace(/^\d+-/, "");
    return {
      label,
      contrastRange: [0.5 * channel.window.start, 1.1 * channel.window.end],
    };
  });
};

export function getGrayscaleChannelProp(): ChannelProps {
  return {
    color: [1, 1, 1],
    visible: true,
    contrastLimits: [-0.00001, 0.00001],
  };
}
