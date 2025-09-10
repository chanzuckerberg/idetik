"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  OmeZarrImageSource,
  OrthographicCamera,
  ImageSeriesLayer,
  Region,
  loadOmeroChannels,
  loadOmeroDefaults,
  ChannelProps,
  Idetik,
  ChunkedImageLayer,
} from "@idetik/core-prerelease";
import { useIdetik } from "../../../hooks/useIdetik";
import { IdetikCanvas } from "../../IdetikCanvas";
import { Button, InputSlider, LoadingIndicator } from "@czi-sds/components";
import cns from "classnames";
import { MODIFIED_SLIDER_STYLES } from "../OmeZarrImageViewer/components/ChannelControlsList/components/ChannelControl/components/ContrastSlider/styles";
import {
  omeroToChannelProps,
  getGrayscaleChannelProp,
  omeroToChannelControls,
  defaultGreyscaleChannel,
  ExtraControlProps,
} from "../OmeZarrImageViewer/utils";
import { ChannelControlsList } from "../OmeZarrImageViewer/components/ChannelControlsList";
import { ScaleBar } from "../OmeZarrImageViewer/components/ScaleBar/ScaleBar";

export interface OmeZarrChunkedImageViewerProps {
  sourceUrl?: string;
  sourceLocalDirectory?: {
    directory: FileSystemDirectoryHandle;
    path?: `/${string}`;
  };
  region: Region;
  fallbackContrastLimits?: [number, number];
  classNames?: {
    root?: string;
  };
  scaleBar?: {
    visible?: boolean;
    align?: "start" | "end" | "center";
  };
  onLayerCreated?: (layer: ChunkedImageLayer, updateZSlice?: (zValue: number) => void) => void;
  onFirstSliceLoaded?: () => void;
}

export function OmeZarrChunkedImageViewer({
  sourceUrl,
  sourceLocalDirectory,
  region,
  fallbackContrastLimits,
  classNames,
  onLayerCreated,
  onFirstSliceLoaded,
  scaleBar = {
    visible: true,
    align: "start",
  },
}: OmeZarrChunkedImageViewerProps) {
  if (sourceUrl !== undefined && sourceLocalDirectory !== undefined) {
    throw new Error("Cannot set both sourceUrl and sourceLocalDirectory.");
  }

  const { isReady: runtimeIsReady, runtime } = useIdetik();

  const [unit, setUnit] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [extraControlProps, setExtraControlProps] = useState<
    ExtraControlProps[]
  >([]);
  const sourceRef = useRef<OmeZarrImageSource | null>(null);
  const imageLayerRef = useRef<ChunkedImageLayer | null>(null);
  const sliceCoordsRef = useRef<{ [key: string]: number } | null>(null);

  // #region Initialization
  const { directory, path } = sourceLocalDirectory ?? {};
  useEffect(() => {
    if (!runtimeIsReady) return;
    const initialize = async () => {
      const source = createSource(sourceUrl, directory, path);
      if (source === undefined) {
        return;
      }
      sourceRef.current = source;
      setLoading(true);
      const loadChannelMetadataPromise = loadChannelMetadata(
        source,
        fallbackContrastLimits
      );
      const loadImageMetadataPromise = loadImageMetadata(
        source,
        region
      );
      const { channelProps, extraControlProps } =
        await loadChannelMetadataPromise;
      const { xUnit, yCoordRange, xCoordRange } =
        await loadImageMetadataPromise;
      if (sourceRef.current !== source) {
        return;
      }
      setExtraControlProps(extraControlProps);
      setUnit(xUnit);
      const { layer, sliceCoords } = createLayer(
        source,
        region,
        channelProps
      );
      imageLayerRef.current = layer;
      sliceCoordsRef.current = sliceCoords;
      
      // Create updateZSlice function for external control
      const updateZSlice = (zValue: number) => {
        if (sliceCoordsRef.current) {
          sliceCoordsRef.current.z = zValue;
        }
      };
      
      onLayerCreated?.(layer, updateZSlice);
      if (sourceRef.current !== source) {
        return;
      }
      runtime.layerManager.add(layer);
      zoomToFit(xCoordRange, yCoordRange, runtime);
      setLoading(false);
      onFirstSliceLoaded?.();
    };
    initialize();
    return () => {
      if (
        imageLayerRef.current &&
        runtime.layerManager.layers.includes(imageLayerRef.current)
      ) {
        runtime.layerManager.remove(imageLayerRef.current);
        imageLayerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only props that trigger reinitialize
  }, [
    sourceUrl,
    region, // TODO: Support region being unstable.
    fallbackContrastLimits,
    directory,
    path,
    runtimeIsReady,
    runtime,
  ]);

  // No complex callbacks needed for ChunkedImageLayer - direct slice coord updates
  // #region DOM
  return (
    <div className={cns("w-full", "h-full", "relative", classNames?.root)}>
      <IdetikCanvas />
      {imageLayerRef.current && (
        <>
          <ChannelControlsList
            layer={imageLayerRef.current}
            extraControlProps={extraControlProps}
            classNames={{ root: "absolute top-0 left-0 z-10" }}
          />
          {scaleBar.visible && (
            <div className="flex flex-col m-sds-l w-1/5 select-none absolute bottom-0 left-0">
              <ScaleBar unit={unit} align={scaleBar.align} />
            </div>
          )}
          <div className="absolute bottom-0 right-0 p-sds-l">
            {loading && <LoadingIndicator sdsStyle="tag" />}
          </div>
        </>
      )}
    </div>
  );
}

// #region Helpers

function createSource(
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

async function loadChannelMetadata(
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

async function loadImageMetadata(
  source: OmeZarrImageSource,
  region: Region
): Promise<{
  xUnit?: string;
  yCoordRange: [number, number];
  xCoordRange: [number, number];
}> {
  const loader = await source.open();
  const attrs = loader.getAttributes();
  const attrsForLevel = attrs[0]; // ChunkedImageLayer doesn't take resolutionLevel param

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

function createLayer(
  source: OmeZarrImageSource,
  region: Region,
  channelProps: ChannelProps[]
): { layer: ChunkedImageLayer, sliceCoords: { [key: string]: number } } {
  // Convert region to sliceCoords for ChunkedImageLayer
  const sliceCoords: { [key: string]: number } = {};
  region.forEach(regionDim => {
    if (regionDim.index?.type === 'point') {
      sliceCoords[regionDim.dimension.toLowerCase()] = regionDim.index.value;
    }
  });
  
  const layer = new ChunkedImageLayer({
    source,
    sliceCoords,
    channelProps,
  });
  
  return { layer, sliceCoords };
}

function zoomToFit(
  xRange: [number, number],
  yRange: [number, number],
  runtime: Idetik
) {
  const camera = runtime.camera as OrthographicCamera;
  camera?.setFrame(xRange[0], xRange[1], yRange[1], yRange[0]);
}