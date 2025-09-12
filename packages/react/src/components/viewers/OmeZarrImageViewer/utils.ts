import { OmeroChannel, ChannelProps, Color } from "@idetik/core-prerelease";

// these are the "extra" properties we need for rendering
// the *control* that core does not track
// (because they're not used for rendering the *image*)
export type ExtraControlProps = {
  label: string;
  contrastRange: [number, number];
};

function getChannelWindow(channel: OmeroChannel) {
  const window = channel.window;
  if (!window) {
    return {
      min: 0,
      start: 0,
      end: 1,
      max: 1,
    };
  }
  return {
    min: window.min,
    start: window.start,
    end: window.end,
    max: window.max,
  };
}

function getChannelColor(channel: OmeroChannel): Color | undefined {
  if (!channel.color) return undefined;
  return Color.fromRgbHex(channel.color);
}

// TODO: the limits/range from the omero channels should possibly be reversed
// (start/end for limits, min/max for range) but the organelle box data works better this way
// TODO: provide a way to get our own limits automatically from the data instead of the metadata
export const omeroToChannelProps = (
  omeroChannels: OmeroChannel[]
): ChannelProps[] => {
  return omeroChannels.map((channel) => {
    const { start, end, min, max } = getChannelWindow(channel);
    return {
      visible: channel.active,
      color: getChannelColor(channel),
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
    const { start, end } = getChannelWindow(channel);
    return {
      label,
      contrastRange: [0.5 * start, 1.1 * end],
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
