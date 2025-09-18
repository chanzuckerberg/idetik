import {
  OmeZarrImageSource,
  OrthographicCamera,
  ChannelProps,
  Idetik,
  loadOmeroChannels,
  OmeroChannel,
  Color,
} from "@idetik/core-prerelease";

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

export function createSource(
  sourceUrl?: string,
  directory?: FileSystemDirectoryHandle,
  path?: `/${string}`
): OmeZarrImageSource | undefined {
  if (sourceUrl !== undefined) {
    return new OmeZarrImageSource(sourceUrl);
  } else if (directory !== undefined) {
    return new OmeZarrImageSource(directory, path);
  }
}

export async function loadChannelMetadata(
  source: OmeZarrImageSource,
  fallbackContrastLimits?: [number, number]
): Promise<{
  channelProps: Array<ChannelProps>;
  extraControlProps: Array<ExtraControlProps>;
}> {
  try {
    const loadedOmeroChannels = await loadOmeroChannels(source);
    let channelProps;
    if (loadedOmeroChannels.length === 0) {
      console.warn(
        "No OMERO channels found. Falling back to 1 grayscale channel."
      );
      channelProps = [getGrayscaleChannelProp(fallbackContrastLimits)];
    } else {
      channelProps = omeroToChannelProps(loadedOmeroChannels);
    }
    return {
      channelProps,
      extraControlProps: omeroToChannelControls(
        loadedOmeroChannels,
        defaultGreyscaleChannel(fallbackContrastLimits)
      ),
    };
  } catch (err) {
    throw new Error(`[Viewer] Failed to load OMERO metadata: ${err}`);
  }
}

export async function loadImageMetadata(source: OmeZarrImageSource): Promise<{
  xUnit?: string;
  yCoordRange: [number, number];
  xCoordRange: [number, number];
}> {
  const loader = await source.open();
  const attrs = loader.getAttributes();
  const attrsForLevel = attrs[0]; // Using level 0 for metadata

  // TODO: We assume that the last dimension will give us the x-unit,
  // which currently holds with idetik but is fragile.
  const dimensionUnits = attrsForLevel.dimensionUnits;
  const xUnit = dimensionUnits[dimensionUnits.length - 1];

  const yIdx = attrsForLevel.dimensionNames.findIndex(
    (d: string) => d.toUpperCase() === "Y"
  );
  const xIdx = attrsForLevel.dimensionNames.findIndex(
    (d: string) => d.toUpperCase() === "X"
  );
  const yCoordRange: [number, number] = [
    0,
    attrsForLevel.shape[yIdx] * attrsForLevel.scale[yIdx],
  ];
  const xCoordRange: [number, number] = [
    0,
    attrsForLevel.shape[xIdx] * attrsForLevel.scale[xIdx],
  ];

  return {
    xUnit,
    yCoordRange,
    xCoordRange,
  };
}

export function zoomToFit(
  xRange: [number, number],
  yRange: [number, number],
  runtime: Idetik
) {
  const camera = runtime.camera as OrthographicCamera;
  camera?.setFrame(xRange[0], xRange[1], yRange[1], yRange[0]);
}
