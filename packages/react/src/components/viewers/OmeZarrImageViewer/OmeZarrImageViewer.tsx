"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  OmeZarrImageSource,
  ImageSeriesLayer,
  Region,
  loadOmeroDefaults,
  ChannelProps,
  ImageLayer,
} from "@idetik/core-prerelease";
import { useIdetik } from "../../../hooks/useIdetik";
import { IdetikCanvas } from "../../IdetikCanvas";
import { Button, InputSlider, LoadingIndicator } from "@czi-sds/components";
import cns from "classnames";
import { MODIFIED_SLIDER_STYLES } from "./components/ChannelControlsList/components/ChannelControl/components/ContrastSlider/styles";
import { ChannelControlsList } from "./components/ChannelControlsList";
import { ScaleBar } from "./components/ScaleBar/ScaleBar";
import {
  createSource,
  loadChannelMetadata as sharedLoadChannelMetadata,
  zoomToFit,
  ExtraControlProps,
} from "../shared/omeZarrHelpers";

export interface OmeZarrImageViewerProps {
  sourceUrl?: string;
  sourceLocalDirectory?: {
    directory: FileSystemDirectoryHandle;
    path?: `/${string}`;
  };
  region: Region;
  seriesDimensionName?: string;
  fallbackContrastLimits?: [number, number];
  resolutionLevel?: number;
  shouldAutoLoadAllSlices?: boolean;
  shouldLoadMiddleZ?: boolean;
  initialIndex?: "start" | "middle" | "end" | "omeroDefault";
  indexIndicatorText?:
  | string
  | ((currentIndex: number, totalIndexes: number) => string);
  loadAllButtonText?: string | (() => string);
  classNames?: {
    root?: string;
    sliceMetadataContainer?: string;
    sliceIndicator?: string;
    load3dButton?: string;
    sliceSliderContainer?: string;
  };
  scaleBar?: {
    visible?: boolean;
    align?: "start" | "end" | "center";
  };
  onLayerCreated?: () => void;
  onFirstSliceLoaded?: () => void;
  onLoadAllSlicesClicked?: () => void;
  onAllSlicesLoaded?: () => void;
  onLoadAllSlicesAborted?: () => void;
}

export function OmeZarrImageViewer({
  sourceUrl,
  sourceLocalDirectory,
  region,
  seriesDimensionName,
  fallbackContrastLimits,
  classNames,
  onLayerCreated,
  onFirstSliceLoaded,
  onLoadAllSlicesClicked,
  onAllSlicesLoaded,
  onLoadAllSlicesAborted,
  resolutionLevel = 0,
  shouldAutoLoadAllSlices = false,
  shouldLoadMiddleZ = false,
  initialIndex = "omeroDefault",
  loadAllButtonText,
  indexIndicatorText,
  scaleBar = {
    visible: true,
    align: "start",
  },
}: OmeZarrImageViewerProps) {
  if (sourceUrl !== undefined && sourceLocalDirectory !== undefined) {
    throw new Error("Cannot set both sourceUrl and sourceLocalDirectory.");
  }

  const { isReady: runtimeIsReady, runtime } = useIdetik();

  const [unit, setUnit] = useState<string>();
  const [zRange, setZRange] = useState<[number, number]>([0, 0]);
  const [zValue, setZValue] = useState(0.5);
  const [loading, setLoading] = useState(true);
  const [allSlicesLoaded, setAllSlicesLoaded] = useState(false);
  const [extraControlProps, setExtraControlProps] = useState<
    ExtraControlProps[]
  >([]);
  const sourceRef = useRef<OmeZarrImageSource | null>(null);
  const imageLayerRef = useRef<ImageLayer | ImageSeriesLayer | null>(null);

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
      setAllSlicesLoaded(false);
      setLoading(true);
      const loadChannelMetadataPromise = sharedLoadChannelMetadata(
        source,
        fallbackContrastLimits
      );
      const loadImageMetadataPromise = loadImageMetadata(
        source,
        region,
        resolutionLevel,
        initialIndex,
        shouldLoadMiddleZ,
        seriesDimensionName
      );
      const { channelProps, extraControlProps } =
        await loadChannelMetadataPromise;
      const { xUnit, zValue, zRange, yCoordRange, xCoordRange } =
        await loadImageMetadataPromise;
      if (sourceRef.current !== source) {
        return;
      }
      setExtraControlProps(extraControlProps);
      setUnit(xUnit);
      setZRange(zRange);
      setZValue(zValue);
      const layer = createLayer(
        source,
        region,
        channelProps,
        resolutionLevel,
        seriesDimensionName
      );
      imageLayerRef.current = layer;
      onLayerCreated?.();
      await updateSeriesIndex(zValue, zRange);
      if (sourceRef.current !== source) {
        return;
      }
      runtime.layerManager.add(layer);
      zoomToFit(xCoordRange, yCoordRange, runtime);
      setLoading(false);
      onFirstSliceLoaded?.();
      if (shouldAutoLoadAllSlices) {
        loadAllSlicesCallback();
      }
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
    resolutionLevel,
    initialIndex, // TODO: Optimize so doesn't require full reinitialization.
    shouldLoadMiddleZ, // TODO: Delete this prop.
    seriesDimensionName,
    shouldAutoLoadAllSlices,
    fallbackContrastLimits,
    directory,
    path,
    runtimeIsReady,
    runtime,
  ]);

  // #region Callbacks

  const updateSeriesIndex = async (
    zValue: number,
    zRange: [number, number]
  ) => {
    if (!(imageLayerRef.current instanceof ImageSeriesLayer)) {
      return;
    }
    let didSetLoadingTrue = false;
    const t = setTimeout(() => {
      setLoading(true);
      didSetLoadingTrue = true;
    }, 50);
    try {
      const zIndex = Math.round(zValue * (zRange[1] - zRange[0]) + zRange[0]);
      await imageLayerRef.current.setIndex(zIndex);
    } catch (err) {
      console.debug("Z index load aborted", err);
    } finally {
      clearTimeout(t);
      if (didSetLoadingTrue) {
        setLoading(false);
      }
    }
  };

  const loadAllSlicesCallback = useCallback(
    async (event?: React.MouseEvent) => {
      const currentSource = sourceRef.current;
      const currentImageLayer = imageLayerRef.current;
      if (!(currentImageLayer instanceof ImageSeriesLayer)) {
        return;
      }
      if (event !== undefined) {
        onLoadAllSlicesClicked?.();
      }
      setLoading(true);
      try {
        await currentImageLayer.preloadSeries();
      } catch (err) {
        console.info("load all slices failed or was aborted", err);
        onLoadAllSlicesAborted?.();
        return;
      } finally {
        if (sourceRef.current === currentSource) {
          setLoading(false);
          onAllSlicesLoaded?.();
          setAllSlicesLoaded(true);
        }
      }
    },
    [onLoadAllSlicesClicked, onAllSlicesLoaded, onLoadAllSlicesAborted]
  );

  const zIndex = Math.round(zValue * (zRange[1] - zRange[0]) + zRange[0]);
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
          <div
            className={cns(
              "flex flex-col grow items-end p-sds-l gap-sds-l absolute bottom-0 right-0",
              classNames?.sliceMetadataContainer
            )}
          >
            {loading && <LoadingIndicator sdsStyle="tag" />}
            {!loading && seriesDimensionName && (
              <div
                // These share styles with ChannelControlsList
                className={cns(
                  "text-white",
                  "text-sm",
                  "bg-black/75",
                  "backdrop-blur-md",
                  "p-sds-xs",
                  "rounded-sds-m",
                  "shadow-sds-m",
                  "font-sds-code",
                  "select-none",
                  classNames?.sliceIndicator
                )}
              >
                {typeof indexIndicatorText === "string" && indexIndicatorText}
                {typeof indexIndicatorText === "function" &&
                  indexIndicatorText(zIndex, zRange[1] - zRange[0])}
                {typeof indexIndicatorText === "undefined" &&
                  `Slice ${zIndex}/${zRange[1] - zRange[0]}`}
              </div>
            )}
            {allSlicesLoaded && (
              <div
                className={cns(
                  "w-full md:w-[200px]",
                  "flex",
                  "bg-black/75",
                  "backdrop-blur-md",
                  "rounded-sds-m",
                  "shadow-sds-m",
                  "py-sds-xs",
                  "px-sds-m",
                  classNames?.sliceSliderContainer
                )}
              >
                <InputSlider
                  min={0}
                  max={1}
                  step={1 / (zRange[1] - zRange[0])}
                  value={zValue}
                  {...MODIFIED_SLIDER_STYLES}
                  onChange={(_, val: number | number[]) => {
                    if (typeof val === "number") {
                      setZValue(val);
                      updateSeriesIndex(val, zRange);
                    }
                  }}
                />
              </div>
            )}
            {!allSlicesLoaded && seriesDimensionName && (
              <Button
                sdsType="primary"
                sdsStyle="square"
                size="small"
                disabled={loading}
                onClick={loadAllSlicesCallback}
                className={cns("shadow-sds-m", classNames?.load3dButton)}
              >
                {typeof loadAllButtonText === "string" && loadAllButtonText}
                {typeof loadAllButtonText === "function" && loadAllButtonText()}
                {typeof loadAllButtonText === "undefined" && "Load 3D high-res"}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// #region Helpers

async function loadImageMetadata(
  source: OmeZarrImageSource,
  region: Region,
  resolutionLevel: number,
  initialIndex: string,
  shouldLoadMiddleZ: boolean,
  seriesDimensionName?: string
): Promise<{
  xUnit?: string;
  zValue: number;
  zRange: [number, number];
  yCoordRange: [number, number];
  xCoordRange: [number, number];
}> {
  const loader = await source.open();
  const attrs = loader.getAttributes();
  const attrsForLevel = attrs[resolutionLevel];

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

  if (seriesDimensionName === undefined) {
    return {
      xUnit,
      zValue: 0,
      zRange: [0, 0],
      yCoordRange,
      xCoordRange,
    };
  }

  const zIdx = attrsForLevel.dimensionNames.findIndex(
    (d: string) => d.toUpperCase() === seriesDimensionName.toUpperCase()
  );

  const min = 0;
  const max = attrsForLevel.shape[zIdx] - 1;

  if (max - min <= 0) {
    return {
      xUnit,
      zValue: 0,
      zRange: [0, 0],
      yCoordRange,
      xCoordRange,
    };
  }

  let initialZ: number;
  const zRegion = region.find(
    (d) => d.dimension.toUpperCase() === seriesDimensionName.toUpperCase()
  );
  const isFullZ = zRegion && zRegion.index?.type === "full";

  if (isFullZ) {
    if (shouldLoadMiddleZ) {
      const zShape = attrsForLevel.shape[zIdx];
      initialZ = Math.floor(zShape / 2);
    } else if (initialIndex === "start") {
      initialZ = 0;
    } else if (initialIndex === "middle") {
      const zShape = attrsForLevel.shape[zIdx];
      initialZ = Math.floor(zShape / 2);
    } else if (initialIndex === "end") {
      const zShape = attrsForLevel.shape[zIdx];
      initialZ = zShape - 1;
    } else {
      const defaults = await loadOmeroDefaults(source);
      if (seriesDimensionName.toUpperCase() === "Z") {
        initialZ = defaults?.defaultZ ?? 0;
      } else if (seriesDimensionName.toUpperCase() === "T") {
        initialZ = defaults?.defaultT ?? 0;
      } else {
        initialZ = 0;
      }
    }
  } else if (zRegion) {
    switch (zRegion.index?.type) {
      case "point":
        initialZ = zRegion.index.value;
        break;
      case "interval":
        initialZ = Math.floor(
          (zRegion.index.start + zRegion.index.stop - 1) / 2
        );
        break;
      default:
        initialZ = 0;
    }
  } else {
    initialZ = 0;
  }

  initialZ = Math.max(min, Math.min(max, initialZ));
  const zNormalized = max - min > 0 ? initialZ / (max - min) : 0;

  let zValue;
  if (Number.isNaN(zNormalized)) {
    console.warn(
      `Computed zValue is NaN. initialZ: ${initialZ}, max: ${max}, min: ${min}`
    );
    zValue = 0.5;
  } else {
    zValue = zNormalized;
  }

  return {
    xUnit,
    zValue,
    zRange: [min, max],
    yCoordRange,
    xCoordRange,
  };
}

function createLayer(
  source: OmeZarrImageSource,
  region: Region,
  channelProps: ChannelProps[],
  resolutionLevel: number,
  seriesDimensionName?: string
): ImageLayer | ImageSeriesLayer {
  return seriesDimensionName === undefined
    ? new ImageLayer({
      source,
      region,
      channelProps,
      lod: resolutionLevel,
    })
    : new ImageSeriesLayer({
      source,
      region,
      channelProps,
      seriesDimensionName,
      lod: resolutionLevel,
    });
}

