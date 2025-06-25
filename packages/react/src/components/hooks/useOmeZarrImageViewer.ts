import { useState, useEffect, useCallback } from "react";
import {
  OmeZarrImageSource,
  OrthographicCamera,
  ImageSeriesLayer,
  Region,
  loadOmeroChannels,
  loadOmeroDefaultZ,
  Idetik,
  PanZoomControls,
  NullControls,
} from "@idetik/core";

import {
  omeroToChannelProps,
  omeroToChannelControls,
  getGrayscaleChannelProp,
  defaultGreyscaleChannel,
} from "../viewers/OmeZarrImageViewer/utils";
import { useIdetik } from ".";

export interface OmeZarrImageViewerProps {
  sourceUrl: string;
  region: Region;
  seriesDimensionName: string;
  cameraControlType?: "panzoom" | "none";
  classNames?: {
    root?: string;
    sliceMetadataContainer?: string;
    sliceIndicator?: string;
    load3dButton?: string;
    sliceSliderContainer?: string;
  };
  onLayerCreated?: () => void;
  onFirstSliceLoaded?: () => void;
  onLoadAllSlicesClicked?: () => void;
  onAllSlicesLoaded?: () => void;
  onLoadAllSlicesAborted?: () => void;
  indexIndicatorText?:
    | string
    | ((currentIndex: number, totalIndexes: number) => string);
  loadAllButtonText?: string | (() => string);
  fallbackContrastLimits?: [number, number];
  lod?: number;
  shouldAutoLoadAllSlices?: boolean;
  initialIndex?: "start" | "middle" | "end" | "omeroDefaultZ";
}

export function useOmeZarrViewer({
  sourceUrl,
  region,
  seriesDimensionName,
  cameraControlType = "panzoom",
  onLayerCreated,
  onFirstSliceLoaded,
  onLoadAllSlicesClicked,
  onAllSlicesLoaded,
  onLoadAllSlicesAborted,
  fallbackContrastLimits,
  lod = 0,
  shouldAutoLoadAllSlices = false,
  initialIndex,
}: OmeZarrImageViewerProps) {
  const [source, setSource] = useState<OmeZarrImageSource | null>(null);
  const [zRange, setZRange] = useState<[number, number]>([0, 0]);
  const [zValue, setZValue] = useState(0.5);
  const [loading, setLoading] = useState(true);
  const [allSlicesLoaded, setAllSlicesLoaded] = useState(false);
  const [unit, setUnit] = useState<string>();
  const { idetik, setIdetik, setChannelControls } = useIdetik();

  useEffect(() => {
    const newSource = new OmeZarrImageSource(sourceUrl);
    setSource(newSource);
    setAllSlicesLoaded(false);
  }, [sourceUrl, lod]);

  const zoomToFit = useCallback(
    (layer: ImageSeriesLayer): OrthographicCamera | void => {
      if (layer.extent) {
        const cam = new OrthographicCamera(
          0,
          layer.extent.x,
          0,
          layer.extent.y
        );
        return cam;
      }
    },
    []
  );

  // Create Image Layer
  useEffect(() => {
    if (!source) return;
    let shouldSetLayer = true;
    let layer: ImageSeriesLayer | null = null;
    const createLayer = async () => {
      setLoading(true);

      try {
        const omeroChannels = await loadOmeroChannels(sourceUrl);
        let channelProps;

        if (omeroChannels.length === 0) {
          console.warn(
            "No OMERO channels found. Falling back to 1 grayscale channel."
          );
          channelProps = [getGrayscaleChannelProp(fallbackContrastLimits)];
        } else {
          channelProps = omeroToChannelProps(omeroChannels);
        }

        layer = new ImageSeriesLayer({
          source,
          region,
          seriesDimensionName,
          channelProps,
          lod,
        });
        layer.setIndex(
          Math.round(zValue * (zRange[1] - zRange[0]) + zRange[0])
        );

        onLayerCreated?.();

        const onFirstLoad = async () => {
          if (!shouldSetLayer || !layer) return;
          const camera = zoomToFit(layer);
          // TODO: Make camera type not possible to be undefined.
          if (camera !== undefined) {
            const cameraControls =
              cameraControlType === "panzoom"
                ? new PanZoomControls(camera, camera.position)
                : new NullControls();
            if (idetik === undefined) {
              setIdetik(
                new Idetik({
                  canvasSelector: "#renderer",
                  camera,
                  layers: [layer],
                  controls: cameraControls,
                })
              );
            } else {
              idetik.layerManager.add(layer);
              idetik.camera = camera;
              idetik.setControls(cameraControls);
            }
            setLoading(false);
            onFirstSliceLoaded?.();
            layer.removeStateChangeCallback(onFirstLoad);

            // Auto load all slices after first slice is loaded if enabled
            if (shouldAutoLoadAllSlices && shouldSetLayer) {
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
            if (shouldSetLayer) {
              setChannelControls(
                omeroToChannelControls(
                  omeroChannels,
                  defaultGreyscaleChannel(fallbackContrastLimits)
                )
              );
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
      shouldSetLayer = false;
      idetik?.layerManager.remove(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Deps that trigger layer creation.
  }, [source, sourceUrl, region, seriesDimensionName, shouldAutoLoadAllSlices]);

  // Fetch Z range from metadata
  useEffect(() => {
    const fetchZRange = async () => {
      if (!source) {
        console.warn("No source available, returning early on fetchZRange");
        return;
      }
      const loader = await source.open();
      const attributes = await loader.loadAttributes();
      const attributesForLOD = attributes[lod];

      // TODO: this does not fit here, but is here because we have the result
      // of loadAttributes. We also assume that the last dimension will give
      // us the x-unit, which currently holds with idetik but is fragile.
      const dimensionUnits = attributesForLOD.dimensionUnits;
      const xUnit = dimensionUnits[dimensionUnits.length - 1];
      if (xUnit === undefined) {
        console.warn(
          "No x-unit found in attributes, setting unit to undefined"
        );
      }
      setUnit(xUnit);

      const zIdx = attributesForLOD.dimensionNames.findIndex(
        (d: string) => d.toUpperCase() === seriesDimensionName.toUpperCase()
      );

      const min = 0;
      const max = attributesForLOD.shape[zIdx] - 1;

      if (max - min <= 0) {
        setZRange([0, 0]);
        setZValue(0);
        return;
      }

      let initialZ: number;
      // Find the Z region and check if it is 'full'
      const zRegion = region.find(
        (d) => d.dimension.toUpperCase() === seriesDimensionName.toUpperCase()
      );
      const isFullZ = zRegion && zRegion.index?.type === "full";

      if (isFullZ) {
        const zShape = attributesForLOD.shape[zIdx];
        switch (initialIndex) {
          case "start":
            initialZ = 0;
            break;
          case "middle":
            initialZ = Math.floor(zShape / 2);
            break;
          case "end":
            initialZ = zShape;
            break;
          case "omeroDefaultZ":
            initialZ = await loadOmeroDefaultZ(sourceUrl);
            break;
          default:
            initialZ = 0;
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

      // Clamp initialZ to valid range
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
    fetchZRange();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Dependencies that affect z range.
  }, [source, seriesDimensionName, sourceUrl, initialIndex]);

  // Update imageLayer's index on Z change
  useEffect(() => {
    if (!idetik) return;
    let didSetLoadingTrue = false;

    const updateIndex = async () => {
      const t = setTimeout(() => {
        setLoading(true);
        didSetLoadingTrue = true;
      }, 50);

      try {
        // Compute zIndex from zValue and zRange
        const zIndex = Math.round(zValue * (zRange[1] - zRange[0]) + zRange[0]);
        await (idetik.layerManager.layers[0] as ImageSeriesLayer)?.setIndex(
          zIndex
        );
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
  }, [idetik, zValue, zRange]);

  const loadAllSlicesCallback = useCallback(async () => {
    if (!idetik) return;
    onLoadAllSlicesClicked?.();
    setLoading(true);
    try {
      await (
        idetik.layerManager.layers[0] as ImageSeriesLayer
      )?.preloadSeries();
    } catch (err) {
      console.info("load all slices failed or was aborted", err);
      onLoadAllSlicesAborted?.();
      return;
    } finally {
      setLoading(false);
    }
    onAllSlicesLoaded?.();
    setAllSlicesLoaded(true);
  }, [
    idetik,
    onLoadAllSlicesClicked,
    onAllSlicesLoaded,
    onLoadAllSlicesAborted,
  ]);

  return {
    zRange,
    zValue,
    setZValue,
    loading,
    allSlicesLoaded,
    loadAllSlicesCallback,
    unit,
  };
}
