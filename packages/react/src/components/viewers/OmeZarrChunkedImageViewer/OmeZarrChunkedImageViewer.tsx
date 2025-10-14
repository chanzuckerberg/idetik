"use client";

import { useState, useEffect, useRef } from "react";
import {
  OmeZarrImageSource,
  SliceCoordinates,
  ChannelProps,
  ChunkLoader,
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
  initZIndex?: number;
  zIndex?: number;
  setZMaxIndex?: (max?: number) => void;
  fallbackContrastLimits?: [number, number];
  classNames?: {
    root?: string;
  };
  scaleBar?: {
    visible?: boolean;
    align?: "start" | "end" | "center";
  };
  onLayerCreated?: (layer: ChunkedImageLayer) => void;
  onFirstSliceLoaded?: () => void;
}

export function OmeZarrChunkedImageViewer({
  sourceUrl,
  sourceLocalDirectory,
  initZIndex,
  zIndex,
  setZMaxIndex,
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

  const { runtime } = useIdetik();

  const [unit, setUnit] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [extraControlProps, setExtraControlProps] = useState<
    ExtraControlProps[]
  >([]);
  const sourceRef = useRef<OmeZarrImageSource | null>(null);
  const imageLayerRef = useRef<ChunkedImageLayer | null>(null);
  const sliceCoordsRef = useRef<SliceCoordinates | null>(null);
  const dimensionMapRef = useRef<ReturnType<
    ChunkLoader["getSourceDimensionMap"]
  > | null>(null);

  const { directory, path } = sourceLocalDirectory ?? {};
  useEffect(() => {
    if (!runtime) return;
    const initialize = async () => {
      const source = createSource(sourceUrl, directory, path);
      if (source === undefined) {
        return;
      }
      sourceRef.current = source;
      setLoading(true);
      const openPromise = source.open();
      const loadChannelMetadataPromise = loadChannelMetadata(
        source,
        fallbackContrastLimits
      );
      const loadImageMetadataPromise = loadImageMetadata(source);
      const loader = await openPromise;
      const { channelProps, extraControlProps } =
        await loadChannelMetadataPromise;
      const { xUnit, yCoordRange, xCoordRange } =
        await loadImageMetadataPromise;
      // Bail out if a newer initialization has started while we were loading
      if (sourceRef.current !== source) {
        return;
      }
      setExtraControlProps(extraControlProps);
      setUnit(xUnit);
      const { layer, sliceCoords } = createLayer(
        source,
        initZIndex,
        channelProps
      );
      imageLayerRef.current = layer;
      sliceCoordsRef.current = sliceCoords;
      dimensionMapRef.current = loader.getSourceDimensionMap();

      const zSize = dimensionMapRef.current.z?.lods[0]?.size;
      setZMaxIndex?.(zSize !== undefined ? zSize - 1 : undefined);

      onLayerCreated?.(layer);
      if (sourceRef.current !== source) {
        return;
      }
      runtime.viewports[0].layerManager.add(layer);
      zoomToFit(xCoordRange, yCoordRange, runtime);
      setLoading(false);
      onFirstSliceLoaded?.();
    };
    initialize();
    return () => {
      if (
        imageLayerRef.current &&
        runtime.viewports[0].layerManager.layers.includes(imageLayerRef.current)
      ) {
        runtime.viewports[0].layerManager.remove(imageLayerRef.current);
        imageLayerRef.current = null;
      }
      sliceCoordsRef.current = null;
    };
  }, [
    sourceUrl,
    initZIndex,
    fallbackContrastLimits,
    directory,
    path,
    runtime,
    onFirstSliceLoaded,
    onLayerCreated,
    setZMaxIndex,
  ]);

  useEffect(() => {
    if (zIndex === undefined) return;
    const sliceCoords = sliceCoordsRef.current;
    if (!sliceCoords) return;
    const zLod0 = dimensionMapRef.current?.z?.lods[0];
    if (!zLod0) return;
    sliceCoords.z = zLod0.translation + zIndex * zLod0.scale;
  }, [zIndex]);

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
  initZCoord: number | undefined,
  channelProps: ChannelProps[]
): { layer: ChunkedImageLayer; sliceCoords: SliceCoordinates } {
  const sliceCoords = { z: initZCoord };
  const layer = new ChunkedImageLayer({
    source,
    sliceCoords,
    channelProps,
  });
  return { layer, sliceCoords };
}
