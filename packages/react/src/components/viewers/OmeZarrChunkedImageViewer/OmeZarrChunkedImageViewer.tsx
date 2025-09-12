"use client";

import { useState, useEffect, useRef } from "react";
import {
  OmeZarrImageSource,
  SliceCoordinates,
  ChannelProps,
  ChunkedImageLayer,
} from "@idetik/core-prerelease";
import { useIdetik } from "../../../hooks/useIdetik";
import { IdetikCanvas } from "../../IdetikCanvas";
import { LoadingIndicator } from "@czi-sds/components";
import cns from "classnames";
import {
  createSource,
  loadChannelMetadata,
  loadImageMetadata,
  zoomToFit,
  ExtraControlProps,
} from "../shared/omeZarrHelpers";
import { ChannelControlsList } from "../OmeZarrImageViewer/components/ChannelControlsList";
import { ScaleBar } from "../OmeZarrImageViewer/components/ScaleBar/ScaleBar";

export interface OmeZarrChunkedImageViewerProps {
  sourceUrl?: string;
  sourceLocalDirectory?: {
    directory: FileSystemDirectoryHandle;
    path?: `/${string}`;
  };
  sliceCoordinates: SliceCoordinates;
  fallbackContrastLimits?: [number, number];
  classNames?: {
    root?: string;
  };
  scaleBar?: {
    visible?: boolean;
    align?: "start" | "end" | "center";
  };
  onLayerCreated?: (
    layer: ChunkedImageLayer,
    updateZSlice?: (zValue: number) => void
  ) => void;
  onFirstSliceLoaded?: () => void;
}

export function OmeZarrChunkedImageViewer({
  sourceUrl,
  sourceLocalDirectory,
  sliceCoordinates,
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
  const sliceCoordsRef = useRef<SliceCoordinates | null>(null);

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
      const loadImageMetadataPromise = loadImageMetadata(source);
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
        sliceCoordinates,
        channelProps
      );
      imageLayerRef.current = layer;
      sliceCoordsRef.current = sliceCoords;

      // Create updateZSlice function for external control
      const updateZSlice = (zValue: number) => {
        if (sliceCoords) {
          sliceCoords.z = zValue;
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
    sliceCoordinates,
    fallbackContrastLimits,
    directory,
    path,
    runtimeIsReady,
    runtime,
  ]);

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

function createLayer(
  source: OmeZarrImageSource,
  sliceCoordinates: SliceCoordinates,
  channelProps: ChannelProps[]
): { layer: ChunkedImageLayer; sliceCoords: SliceCoordinates } {
  const layer = new ChunkedImageLayer({
    source,
    sliceCoords: sliceCoordinates,
    channelProps,
  });

  return { layer, sliceCoords: sliceCoordinates };
}
