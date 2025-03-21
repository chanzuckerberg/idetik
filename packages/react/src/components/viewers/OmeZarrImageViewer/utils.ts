import { OmeroChannel, ChannelProps } from "@idetik/core";
import type { ChannelControlProps } from "components/controls/ChannelControl";
import { hexToRgb } from "lib/color";

// TODO: the limits/range from the omero channels should possibly be reversed
// (start/end for limits, min/max for range) but the organelle box data works better this way
// TODO: provide a way to get our own limits automatically from the data instead of the metadata
export const omeroToChannelProps = (
  omeroChannels: OmeroChannel[]
): ChannelProps[] => {
  return omeroChannels.map((channel: OmeroChannel) => {
    const { start, end, min, max } = channel.window;
    return {
      visible: channel.active,
      color: hexToRgb(channel.color),
      contrastLimits: [Math.max(start, min), Math.min(end, max)],
    };
  });
};

export const omeroToControlProps = (
  omeroChannels: OmeroChannel[]
): Partial<ChannelControlProps>[] => {
  return omeroChannels.map((channel: OmeroChannel, index: number) => {
    // remove prefix (number + hyphen) from label if present (seen in organelle box data)
    const label = (channel.label ?? `Ch${index}`).replace(/^\d+-/, "");
    return {
      label,
      contrastRange: [0.5 * channel.window.start, 1.1 * channel.window.end],
    };
  });
};
