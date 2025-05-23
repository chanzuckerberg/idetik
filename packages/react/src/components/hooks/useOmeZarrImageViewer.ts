import { useState, useEffect, useCallback } from "react";
import {
  LayerManager,
  OmeZarrImageSource,
  OrthographicCamera,
  ImageSeriesLayer,
  Region,
  loadOmeroChannels,
  loadOmeroDefaultZ,
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
  console.log("useOmeZarrViewer hook called with:", {
    sourceUrl,
    region,
    seriesDimensionName,
    resolutionLevel,
    shouldAutoLoadAllSlices,
  });
  const [source, setSource] = useState<OmeZarrImageSource | null>(null);
  const [layerManager, setLayerManager] = useState(() => new LayerManager());
  const [camera, setCamera] = useState<OrthographicCamera | null>(null);
  const [imageLayer, setImageLayer] = useState<ImageSeriesLayer | null>(null);
  const [zRange, setZRange] = useState<[number, number]>([0, 0]);
  const [zValue, setZValue] = useState(0.5);
  const [zIndex, setZIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [allSlicesLoaded, setAllSlicesLoaded] = useState(false);
  const { setImageSeriesLayer, clearImageSeriesLayer, setChannelControls } =
    useIdetik();

  useEffect(() => {
    if (imageLayer) {
      imageLayer.setIndex(zIndex);
    }
  }, [imageLayer, zIndex]);

  useEffect(() => {
    if (imageLayer) {
      const newManager = new LayerManager();
      newManager.add(imageLayer);
      setLayerManager(newManager);
    }
  }, [imageLayer]);

  useEffect(() => {
    const newSource = new OmeZarrImageSource(sourceUrl, resolutionLevel);
    setSource(newSource);
    setAllSlicesLoaded(false);
  }, [sourceUrl, resolutionLevel]);

  const zoomToFit = useCallback((layer: ImageSeriesLayer) => {
    if (layer.extent) {
      const cam = new OrthographicCamera(0, layer.extent.x, 0, layer.extent.y);
      setCamera(cam);
      return true;
    }
    return false;
  }, []);

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

        onLayerCreated?.();

        const onFirstLoad = async () => {
          console.log("[Viewer] First slice loaded");
          if (!shouldSetLayer || !layer) return;
          if (zoomToFit(layer)) {
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
          }
        };

        layer.addStateChangeCallback(onFirstLoad);

        if (shouldSetLayer) {
          setImageLayer(layer);
          setImageSeriesLayer(layer);
          setChannelControls(
            omeroToChannelControls(
              omeroChannels,
              defaultGreyscaleChannel(fallbackContrastLimits)
            )
          );
        }
      } catch (err) {
        console.error("[Viewer] Failed to load OMERO metadata:", err);
      }
    };

    createLayer();

    return () => {
      shouldSetLayer = false;
      layer?.close();
      setImageLayer(null);
      clearImageSeriesLayer();
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
        setZIndex(0);
        return;
      }

      let initialZ: number;
      if (shouldLoadMiddleZ) {
        // Calculate middle z value from shape array
        const zShape = attrs.shape[zIdx];
        initialZ = Math.floor(zShape / 2);
      } else {
        // Use default Z from metadata
        initialZ = await loadOmeroDefaultZ(sourceUrl);
      }

      const zNormalized = initialZ / (max - min);

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
  }, [source, seriesDimensionName, sourceUrl, shouldLoadMiddleZ]);

  // Calculate zIndex whenever zValue or zRange changes
  useEffect(() => {
    setZIndex(Math.round(zValue * (zRange[1] - zRange[0]) + zRange[0]));
  }, [zValue, zRange]);

  // Update imageLayer's index on Z change
  useEffect(() => {
    if (!imageLayer) return;
    let didSetLoadingTrue = false;

    const updateIndex = async () => {
      const t = setTimeout(() => {
        setLoading(true);
        didSetLoadingTrue = true;
      }, 50);

      try {
        await imageLayer.setIndex(zIndex);
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
  }, [zIndex, imageLayer]);

  const loadAllSlicesCallback = useCallback(async () => {
    if (!imageLayer) return;
    onLoadAllSlicesClicked?.();
    setLoading(true);
    try {
      await imageLayer.preloadSeries();
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
    imageLayer,
    onLoadAllSlicesClicked,
    onAllSlicesLoaded,
    onLoadAllSlicesAborted,
  ]);

  return {
    layerManager,
    camera,
    zRange,
    zValue,
    zIndex,
    setZValue,
    loading,
    allSlicesLoaded,
    loadAllSlicesCallback,
  };
}
