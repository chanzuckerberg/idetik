import { useState, useEffect, useCallback } from "react";
import {
  OmeZarrImageSource,
  OrthographicCamera,
  ImageSeriesLayer,
  Region,
  loadOmeroChannels,
  loadOmeroDefaultZ,
  Idetik,
} from "@idetik/core";

import {
  omeroToChannelProps,
  omeroToChannelControls,
  getGrayscaleChannelProp,
  defaultGreyscaleChannel,
} from "../viewers/OmeZarrImageViewer/utils";
import { useIdetik } from ".";

interface UseOmeZarrViewerProps {
  sourceUrl: string;
  region: Region;
  seriesDimensionName: string;
  onLayerCreated?: () => void;
  onFirstSliceLoaded?: () => void;
  onLoadAllSlicesClicked?: () => void;
  onAllSlicesLoaded?: () => void;
  onLoadAllSlicesAborted?: () => void;
  fallbackContrastLimits?: [number, number];
  resolutionLevel?: number;
  shouldAutoLoadAllSlices?: boolean;
  shouldLoadMiddleZ?: boolean;
}

export function useOmeZarrViewer({
  sourceUrl,
  region,
  seriesDimensionName,
  onLayerCreated,
  onFirstSliceLoaded,
  onLoadAllSlicesClicked,
  onAllSlicesLoaded,
  onLoadAllSlicesAborted,
  fallbackContrastLimits,
  resolutionLevel = 0,
  shouldAutoLoadAllSlices = false,
  shouldLoadMiddleZ = false,
}: UseOmeZarrViewerProps) {
  const [source, setSource] = useState<OmeZarrImageSource | null>(null);
  const [zRange, setZRange] = useState<[number, number]>([0, 0]);
  const [zValue, setZValue] = useState(0.5);
  const [loading, setLoading] = useState(true);
  const [allSlicesLoaded, setAllSlicesLoaded] = useState(false);
  const { idetik, setIdetik, clear, setChannelControls } = useIdetik();

  useEffect(() => {
    const newSource = new OmeZarrImageSource(sourceUrl, resolutionLevel);
    setSource(newSource);
    setAllSlicesLoaded(false);
  }, [sourceUrl, resolutionLevel]);

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
        });
        layer.setIndex(
          Math.round(zValue * (zRange[1] - zRange[0]) + zRange[0])
        );

        onLayerCreated?.();

        const onFirstLoad = async () => {
          if (!shouldSetLayer || !layer) return;
          const camera = zoomToFit(layer);
          if (camera !== undefined) {
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
              setIdetik(
                new Idetik({
                  canvasSelector: "#renderer",
                  camera,
                  layers: [layer],
                })
              );
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
      clear();
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
      const attrs = await loader.loadAttributes();

      const zIdx = attrs.dimensionNames.findIndex(
        (d: string) => d.toUpperCase() === seriesDimensionName.toUpperCase()
      );

      const min = 0;
      const max = attrs.shape[zIdx] - 1;

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
        if (shouldLoadMiddleZ) {
          const zShape = attrs.shape[zIdx];
          initialZ = Math.floor(zShape / 2);
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
  }, [source, seriesDimensionName, sourceUrl, shouldLoadMiddleZ]);

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
  };
}
