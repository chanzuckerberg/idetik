"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  OmeZarrImageSource,
  OrthographicCamera,
  ImageSeriesLayer,
  Region,
  loadOmeroChannels,
  loadOmeroDefaultZ,
  ChannelProps,
  Idetik,
} from "@idetik/core";
import { useIdetik } from "../../../hooks/useIdetik";
import { IdetikCanvas } from "../../IdetikCanvas";
import { Button, InputSlider, LoadingIndicator } from "@czi-sds/components";
import cns from "classnames";
import { MODIFIED_SLIDER_STYLES } from "./components/ChannelControlsList/components/ChannelControl/components/ContrastSlider/styles";
import {
  omeroToChannelProps,
  getGrayscaleChannelProp,
  omeroToChannelControls,
  defaultGreyscaleChannel,
  ExtraControlProps,
} from "./utils";
import { ChannelControlsList } from "./components/ChannelControlsList";
import { ScaleBar } from "./components/ScaleBar/ScaleBar";

export interface OmeZarrImageViewerProps {
  sourceUrl?: string;
  sourceLocalDirectory?: {
    directory: FileSystemDirectoryHandle;
    path?: `/${string}`;
  };
  region: Region;
  seriesDimensionName: string;
  fallbackContrastLimits?: [number, number];
  resolutionLevel?: number;
  shouldAutoLoadAllSlices?: boolean;
  shouldLoadMiddleZ?: boolean;
  initialIndex?: "start" | "middle" | "end" | "omeroDefaultZ";
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
  initialIndex = "omeroDefaultZ",
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

  const [source, setSource] = useState<OmeZarrImageSource | null>(null);
  const [unit, setUnit] = useState<string>();
  const [zRange, setZRange] = useState<[number, number]>([0, 0]);
  const [zValue, setZValue] = useState(0.5);
  const [loading, setLoading] = useState(true);
  const [allSlicesLoaded, setAllSlicesLoaded] = useState(false);
  const [extraControlProps, setExtraControlProps] = useState<
    ExtraControlProps[]
  >([]);
  const imageLayerRef = useRef<ImageSeriesLayer | null>(null);

  // #region Initialization
  const { directory, path } = sourceLocalDirectory ?? {};
  useEffect(() => {
    if (!runtimeIsReady) return;
    const initialize = async () => {
      const source = createSource(sourceUrl, directory, path);
      if (source === undefined) {
        return;
      }
      setSource(source);
      setAllSlicesLoaded(false);
      setLoading(true);
      const loadChannelMetadataPromise = loadChannelMetadata(
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
      const { xUnit, zRange, zValue } = await loadImageMetadataPromise;
      setExtraControlProps(extraControlProps);
      setUnit(xUnit);
      setZRange(zRange);
      setZValue(zValue);
      const layer = createLayer(
        source,
        region,
        channelProps,
        seriesDimensionName,
        resolutionLevel
      );
      imageLayerRef.current = layer;
      onLayerCreated?.();
      await updateSeriesIndex(zValue);
      if (imageLayerRef.current !== layer) {
        return;
      }
      runtime.layerManager.add(layer);
      imageLayerRef.current = layer;
      setCameraFrame(layer, runtime);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- These are the only props that matter
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

  const updateSeriesIndex = async (zValue: number) => {
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
      await imageLayerRef.current?.setIndex(zIndex);
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
      const currentImageLayer = imageLayerRef.current;
      if (!currentImageLayer) return;
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
        if (imageLayerRef.current === currentImageLayer) {
          setLoading(false);
        }
      }
      if (imageLayerRef.current == currentImageLayer) {
        onAllSlicesLoaded?.();
        setAllSlicesLoaded(true);
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
        <ChannelControlsList
          layer={imageLayerRef.current}
          extraControlProps={extraControlProps}
          classNames={{ root: "absolute top-0 left-0 z-10" }}
        />
      )}
      {source && (
        <div
          className={cns(
            "flex",
            "absolute",
            "bottom-0",
            "w-full",
            "items-end",
            "justify-between",
            "gap-sds-l"
          )}
        >
          {scaleBar.visible && (
            <div
              className={cns(
                "flex",
                "flex-col",
                "m-sds-l",
                "w-1/5",
                "select-none"
              )}
            >
              <ScaleBar unit={unit} align={scaleBar.align} />
            </div>
          )}
          {imageLayerRef.current instanceof ImageSeriesLayer && (
            <div
              className={cns(
                "flex",
                "flex-col",
                "grow",
                "items-end",
                "p-sds-l",
                "gap-sds-l",
                classNames?.sliceMetadataContainer
              )}
            >
              {!loading ? (
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
              ) : (
                <LoadingIndicator sdsStyle="tag" />
              )}
              {!allSlicesLoaded ? (
                <Button
                  sdsType="primary"
                  sdsStyle="square"
                  size="small"
                  disabled={loading}
                  onClick={loadAllSlicesCallback}
                  className={cns("shadow-sds-m", classNames?.load3dButton)}
                >
                  {typeof loadAllButtonText === "string" && loadAllButtonText}
                  {typeof loadAllButtonText === "function" &&
                    loadAllButtonText()}
                  {typeof loadAllButtonText === "undefined" &&
                    "Load 3D high-res"}
                </Button>
              ) : (
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
                        updateSeriesIndex(val);
                      }
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
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
  region: Region,
  resolutionLevel: number,
  initialIndex: string,
  shouldLoadMiddleZ: boolean,
  seriesDimensionName?: string
): Promise<{ xUnit?: string; zRange: [number, number]; zValue: number }> {
  const loader = await source.open();
  const attrs = await loader.loadAttributes();
  const attrsForLevel = attrs[resolutionLevel];

  // TODO: We assume that the last dimension will give us the x-unit,
  // which currently holds with idetik but is fragile.
  const dimensionUnits = attrsForLevel.dimensionUnits;
  const xUnit = dimensionUnits[dimensionUnits.length - 1];

  if (seriesDimensionName === undefined) {
    return {
      xUnit,
      zRange: [0, 0],
      zValue: 0,
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
      zRange: [0, 0],
      zValue: 0,
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
      initialZ = await loadOmeroDefaultZ(source);
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
    zRange: [min, max],
    zValue,
  };
}

function createLayer(
  source: OmeZarrImageSource,
  region: Region,
  channelProps: ChannelProps[],
  seriesDimensionName: string,
  resolutionLevel: number
): ImageSeriesLayer {
  // TODO(bchu): Add ImageLayer.
  return new ImageSeriesLayer({
    source,
    region,
    channelProps,
    seriesDimensionName,
    lod: resolutionLevel,
  });
}

function setCameraFrame(layer: ImageSeriesLayer, runtime: Idetik) {
  if (layer.extent) {
    const { x, y } = layer.extent;
    const camera = runtime.camera as OrthographicCamera;
    camera?.setFrame(0, x, y, 0);
  }
}
