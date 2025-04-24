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

import { omeroToChannelProps, omeroToControlProps } from "./utils";
import { ChannelControlProps } from "./components/ChannelControlsList/components/ChannelControl";

interface UseOmeZarrViewerProps {
  sourceUrl: string;
  region: Region;
  seriesDimensionName: string;
  onLayerCreated?: () => void;
  onFirstSliceLoaded?: () => void;
  onLoadAllSlicesClicked?: () => void;
  onAllSlicesLoaded?: () => void;
  onLoadAllSlicesAborted?: () => void;
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
}: UseOmeZarrViewerProps) {
  const [source, setSource] = useState<OmeZarrImageSource | null>(null);
  const [layerManager, setLayerManager] = useState(() => new LayerManager());
  const [camera, setCamera] = useState<OrthographicCamera | null>(null);
  const [imageLayer, setImageLayer] = useState<ImageSeriesLayer | null>(null);
  const [controlProps, setControlProps] = useState<
    Partial<ChannelControlProps>[]
  >([]);
  const [zRange, setZRange] = useState<[number, number]>([0, 0]);
  const [zValue, setZValue] = useState(0.5);
  const [loading, setLoading] = useState(true);
  const [allSlicesLoaded, setAllSlicesLoaded] = useState(false);

  useEffect(() => {
    if (imageLayer) {
      const newManager = new LayerManager();
      newManager.add(imageLayer);
      setLayerManager(newManager);
    }
  }, [imageLayer]);

  useEffect(() => {
    const newSource = new OmeZarrImageSource(sourceUrl, 0);
    setSource(newSource);
    setAllSlicesLoaded(false);
  }, [sourceUrl]);

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
    console.log("[Viewer] Creating image layer");
    console.log("[Viewer] Loading omero channels from", sourceUrl);
    const createLayer = async () => {
      setLoading(true);
      const omeroChannels = await loadOmeroChannels(sourceUrl);
      const channelProps = omeroToChannelProps(omeroChannels);
      setControlProps(omeroToControlProps(omeroChannels));

      layer = new ImageSeriesLayer({
        source,
        region,
        seriesDimensionName,
        channelProps,
      });

      onLayerCreated?.();

      const onFirstLoad = () => {
        console.log("[Viewer] First slice loaded");
        if (!shouldSetLayer) return;
        if (zoomToFit(layer!)) {
          setLoading(false);
          onFirstSliceLoaded?.();
          layer?.removeStateChangeCallback(onFirstLoad);
        }
      };

      layer.addStateChangeCallback(onFirstLoad);

      if (shouldSetLayer) {
        setImageLayer(layer);
      }
    };

    createLayer();

    return () => {
      shouldSetLayer = false;
      layer?.close();
      setImageLayer(null);
    };
  }, [
    source,
    sourceUrl,
    region,
    seriesDimensionName,
    zoomToFit,
    onLayerCreated,
    onFirstSliceLoaded,
  ]);

  // Fetch Z range from metadata
  useEffect(() => {
    const fetchZRange = async () => {
      if (!source) return;
      const loader = await source.open();
      const attrs = await loader.loadAttributes();

      const zIdx = attrs.dimensionNames.findIndex(
        (d) => d === seriesDimensionName
      );
      const min = 0;
      const max = attrs.shape[zIdx] - 1;
      const defaultZ = await loadOmeroDefaultZ(sourceUrl);

      setZValue(defaultZ / (max - min));
      setZRange([min, max]);
    };

    fetchZRange();
  }, [source, seriesDimensionName, sourceUrl]);

  const zIndex = Math.round(zValue * (zRange[1] - zRange[0]) + zRange[0]);
  console.log("[Viewer] zRange", zRange, "zValue", zValue, "zIndex", zIndex);

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
      } catch {
        console.debug("Z index load aborted");
      } finally {
        clearTimeout(t);
        if (didSetLoadingTrue) {
          setLoading(false);
        }
      }
    };

    updateIndex();
  }, [zIndex, imageLayer]);

  const resetChannelsCallback = useCallback(async () => {
    if (!source || !imageLayer) return;
    const omeroChannels = await loadOmeroChannels(sourceUrl);
    imageLayer.setChannelProps(omeroToChannelProps(omeroChannels));
    setControlProps(omeroToControlProps(omeroChannels));
  }, [source, sourceUrl, imageLayer]);

  const loadAllSlicesCallback = useCallback(async () => {
    if (!imageLayer) return;
    onLoadAllSlicesClicked?.();
    setLoading(true);
    try {
      await imageLayer.preloadSeries();
    } catch {
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
    imageLayer,
    controlProps,
    zRange,
    zValue,
    zIndex,
    setZValue,
    loading,
    allSlicesLoaded,
    resetChannelsCallback,
    loadAllSlicesCallback,
  };
}
