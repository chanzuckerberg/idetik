"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  OmeZarrImageSource,
  OrthographicCamera,
  ImageSeriesLayer,
  Region,
  loadOmeroChannels,
  loadOmeroDefaultZ,
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

interface OmeZarrImageViewerProps {
  sourceUrl: string;
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
    scaleBarContainer?: string;
  };
  onLayerCreated?: () => void;
  onFirstSliceLoaded?: () => void;
  onLoadAllSlicesClicked?: () => void;
  onAllSlicesLoaded?: () => void;
  onLoadAllSlicesAborted?: () => void;
}

export function OmeZarrImageViewer(props: OmeZarrImageViewerProps) {
  const {
    sourceUrl,
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
  } = props;

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

  // Create source when URL or resolution changes
  useEffect(() => {
    const newSource = new OmeZarrImageSource(sourceUrl);
    setSource(newSource);
    setAllSlicesLoaded(false);
  }, [sourceUrl, resolutionLevel]);

  // Create Image Layer
  useEffect(() => {
    if (!source || !runtimeIsReady) return;

    const createLayer = async () => {
      setLoading(true);

      try {
        const loadedOmeroChannels = await loadOmeroChannels(sourceUrl);
        let channelProps;

        if (loadedOmeroChannels.length === 0) {
          console.warn(
            "No OMERO channels found. Falling back to 1 grayscale channel."
          );
          channelProps = [getGrayscaleChannelProp(fallbackContrastLimits)];
        } else {
          channelProps = omeroToChannelProps(loadedOmeroChannels);
        }

        const extraControlProps = omeroToChannelControls(
          loadedOmeroChannels,
          defaultGreyscaleChannel(fallbackContrastLimits)
        );
        setExtraControlProps(extraControlProps);

        const layer = new ImageSeriesLayer({
          source,
          region,
          seriesDimensionName,
          channelProps,
          lod: resolutionLevel,
        });
        imageLayerRef.current = layer;

        onLayerCreated?.();

        const onFirstLoad = async () => {
          if (imageLayerRef.current !== layer) return;

          runtime.layerManager.add(layer);
          imageLayerRef.current = layer;

          // Set camera frame from layer extent like in App.tsx
          if (layer.extent && runtime) {
            const { x, y } = layer.extent;
            const camera = runtime.camera as OrthographicCamera;
            camera?.setFrame(0, x, y, 0);
          }

          setLoading(false);
          onFirstSliceLoaded?.();
          layer.removeStateChangeCallback(onFirstLoad);

          // Auto load all slices after first slice is loaded if enabled
          if (shouldAutoLoadAllSlices) {
            setLoading(true);
            try {
              await layer.preloadSeries();
              onAllSlicesLoaded?.();
              setAllSlicesLoaded(true);
            } catch (err) {
              console.warn("Auto-load all slices failed or was aborted", err);
              onLoadAllSlicesAborted?.();
            } finally {
              setLoading(false);
            }
          }
        };

        layer.addStateChangeCallback(onFirstLoad);
      } catch (err) {
        console.error("[Viewer] Failed to load OMERO metadata:", err);
      }
    };

    createLayer();

    return () => {
      if (
        imageLayerRef.current &&
        runtime.layerManager.layers.includes(imageLayerRef.current)
      ) {
        runtime.layerManager.remove(imageLayerRef.current);
        imageLayerRef.current = null;
      }
    };
  }, [
    source,
    sourceUrl,
    region,
    seriesDimensionName,
    shouldAutoLoadAllSlices,
    runtimeIsReady,
    runtime,
    fallbackContrastLimits,
    onLayerCreated,
    onFirstSliceLoaded,
    onAllSlicesLoaded,
    onLoadAllSlicesAborted,
    resolutionLevel,
  ]);

  // Fetch metadata including Z range
  useEffect(() => {
    const fetchMetadata = async () => {
      if (!source) {
        console.warn("No source available, returning early on fetchZRange");
        return;
      }
      const loader = await source.open();
      const attrs = await loader.loadAttributes();
      const attrsForLevel = attrs[resolutionLevel];

      // TODO: We assume that the last dimension will give us the x-unit,
      // which currently holds with idetik but is fragile.
      const dimensionUnits = attrsForLevel.dimensionUnits;
      const xUnit = dimensionUnits[dimensionUnits.length - 1];
      setUnit(xUnit);

      const zIdx = attrsForLevel.dimensionNames.findIndex(
        (d: string) => d.toUpperCase() === seriesDimensionName.toUpperCase()
      );

      const min = 0;
      const max = attrsForLevel.shape[zIdx] - 1;

      if (max - min <= 0) {
        setZRange([0, 0]);
        setZValue(0);
        return;
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
          initialZ = await loadOmeroDefaultZ(sourceUrl);
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

      if (Number.isNaN(zNormalized)) {
        console.warn(
          `Computed zValue is NaN. initialZ: ${initialZ}, max: ${max}, min: ${min}`
        );
        setZValue(0.5);
      } else {
        setZValue(zNormalized);
      }

      setZRange([min, max]);
    };
    fetchMetadata();
  }, [
    region,
    source,
    seriesDimensionName,
    sourceUrl,
    shouldLoadMiddleZ,
    initialIndex,
    resolutionLevel,
  ]);

  // Update imageLayer's index on Z change
  useEffect(() => {
    if (!imageLayerRef.current) return;
    let didSetLoadingTrue = false;

    const updateIndex = async () => {
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

    updateIndex();
  }, [zValue, zRange]);

  const loadAllSlicesCallback = useCallback(async () => {
    const currentImageLayer = imageLayerRef.current;
    if (!currentImageLayer) return;
    onLoadAllSlicesClicked?.();
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
  }, [onLoadAllSlicesClicked, onAllSlicesLoaded, onLoadAllSlicesAborted]);

  // Compute zIndex for display
  const zIndex = Math.round(zValue * (zRange[1] - zRange[0]) + zRange[0]);
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
      <div
        className={cns(
          "flex",
          "flex-row",
          "absolute",
          "bottom-0",
          "w-full",
          "items-end",
          "justify-between",
          "gap-sds-l"
        )}
      >
        <div
          className={cns(
            "flex",
            "flex-col",
            "m-sds-l",
            "p-sds-xs",
            // TODO: decide if style should match others.
            // "bg-black/75",
            // "backdrop-blur-md",
            // "rounded-sds-m",
            // "shadow-sds-m",
            "w-1/5",
            "box-border",
            "select-none",
            props.classNames?.scaleBarContainer
          )}
        >
          <ScaleBar idetik={runtime} unit={unit} />
        </div>
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
              {typeof loadAllButtonText === "function" && loadAllButtonText()}
              {typeof loadAllButtonText === "undefined" && "Load 3D high-res"}
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
                  if (typeof val === "number") setZValue(val);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
