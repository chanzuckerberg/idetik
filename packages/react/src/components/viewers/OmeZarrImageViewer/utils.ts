import { OmeroChannel, ChannelProps, Color } from "@idetik/core";

// these are the "extra" properties we need for rendering
// the *control* that core does not track
// (because they're not used for rendering the *image*)
export type ExtraControlProps = {
  label: string;
  contrastRange: [number, number];
};

// TODO: the limits/range from the omero channels should possibly be reversed
// (start/end for limits, min/max for range) but the organelle box data works better this way
// TODO: provide a way to get our own limits automatically from the data instead of the metadata
export const omeroToChannelProps = (
  omeroChannels: OmeroChannel[]
): ChannelProps[] => {
  return omeroChannels.map((channel) => {
    if (!channel.window) {
      return {} as ChannelProps;
    }
    const { start, end, min, max } = channel.window;
    const color = channel.color;
    return {
      visible: channel.active,
      color: color === undefined ? undefined : Color.fromRgbHex(color),
      contrastLimits: [Math.max(start, min), Math.min(end, max)],
    };
  });
};

export const defaultGreyscaleChannel = (
  contrastLimits: [number, number] = [0, 1]
): ExtraControlProps => ({
  label: "Greyscale",
  contrastRange: contrastLimits,
});

export const omeroToChannelControls = (
  omeroChannels: OmeroChannel[] | undefined,
  defaultChannel?: ExtraControlProps
): ExtraControlProps[] => {
  if (!omeroChannels || omeroChannels.length === 0) {
    // No OMERO channels, return the default greyscale channel if provided
    return defaultChannel ? [defaultChannel] : [];
  }
  return omeroChannels.map((channel, index) => {
    // remove prefix (number + hyphen) from label if present (seen in organelle box data)
    const label = (channel.label ?? `Ch${index}`).replace(/^\d+-/, "");
    const window = channel.window;
    if (window === undefined) {
      return {
        label,
        contrastRange: [0, 1],
      };
    }
    return {
      label,
      contrastRange: [0.5 * window.start, 1.1 * window.end],
    };
  });
};

export function getGrayscaleChannelProp(
  contrastLimits?: [number, number]
): ChannelProps {
  return {
    color: [1, 1, 1],
    visible: true,
    contrastLimits: contrastLimits ?? [-0.00001, 0.00001],
  };
}
