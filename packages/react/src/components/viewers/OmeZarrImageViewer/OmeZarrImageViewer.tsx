import { useCallback, useEffect, useState } from "react";
import cns from "classnames";
import { Button, InputSlider, LoadingIndicator } from "@czi-sds/components";
import {
  ImageSeriesLayer,
  LayerManager,
  OmeZarrImageSource,
  OrthographicCamera,
  Region,
  loadOmeroChannels,
  loadOmeroDefaultZ,
} from "@idetik/core";

import { Renderer } from "./components/Renderer";
import { ChannelControlsList } from "./components/ChannelControlsList";
import { ChannelControlProps } from "./components/ChannelControlsList/components/ChannelControl";
import { omeroToChannelProps, omeroToControlProps } from "./utils";

interface OmeZarrImageViewerProps {
  sourceUrl: string;
  region: Region;
  seriesDimensionName: string;
  allSlicesSizeEstimate?: string;
}

interface OmeZarrImageViewerEvents {
  onLayerCreated?: () => void;
  onFirstSliceLoaded?: () => void;
  onLoadAllSlicesClicked?: () => void;
  onAllSlicesLoaded?: () => void;
  onLoadAllSlicesAborted?: () => void;
}

// consolidated state to prevent effects from firing multiple times
interface SourceState {
  source: OmeZarrImageSource | null;
  url: string;
}

export function OmeZarrImageViewer(
  props: OmeZarrImageViewerProps & OmeZarrImageViewerEvents
) {
  const [layerManager, setLayerManager] = useState<LayerManager>(
    new LayerManager()
  );
  const [camera, setCamera] = useState<OrthographicCamera | null>(null);
  const [source, setSource] = useState<SourceState>({
    source: null,
    url: props.sourceUrl,
  });
  const [loading, setLoading] = useState(true);
  const [allSlicesLoaded, setAllSlicesLoaded] = useState(false);
  const [imageLayer, setImageLayer] = useState<ImageSeriesLayer | null>(null);

  const [controlProps, setControlProps] = useState<
    Partial<ChannelControlProps>[]
  >([]);

  const [zRange, setZRange] = useState<[number, number]>([0, 0]);
  const [zValue, setZValue] = useState(0.5);

  // set a new source whenever *any* prop changes to force reload
  useEffect(() => {
    // 0 is the highest resolution
    const source = new OmeZarrImageSource(props.sourceUrl, 0);
    setSource({
      source,
      url: props.sourceUrl,
    });
    setAllSlicesLoaded(false);
  }, [props]);

  const zoomToFit = useCallback(
    (layer: ImageSeriesLayer) => {
      if (layer.extent !== undefined) {
        const newCamera = new OrthographicCamera(
          0,
          layer.extent.x,
          0,
          layer.extent.y
        );
        setCamera(newCamera);
        return true;
      }
      return false;
    },
    [setCamera]
  );

  // destructure props to narrow useEffect dependencies
  const {
    region,
    seriesDimensionName,
    onLayerCreated,
    onFirstSliceLoaded,
    onLoadAllSlicesClicked,
    onAllSlicesLoaded,
    onLoadAllSlicesAborted,
  } = props;

  useEffect(() => {
    console.log("Creating image layer", source.url);
    let shouldSetLayer = true;
    let layer: ImageSeriesLayer | null = null;
    const createImageLayer = async () => {
      setLoading(true);
      if (!source.source) return;
      // TODO: may need to accept channel properties to be possibly overridden here
      // (i.e. for initial visibility, custom colors)
      const omeroChannels = await loadOmeroChannels(source.url);
      const channelProps = omeroToChannelProps(omeroChannels);
      setControlProps(omeroToControlProps(omeroChannels));
      layer = new ImageSeriesLayer({
        source: source.source,
        region,
        seriesDimensionName,
        channelProps,
      });
      onLayerCreated?.();
      const onFirstLoad = () => {
        if (!layer || !shouldSetLayer) {
          return;
        }
        if (zoomToFit(layer)) {
          setLoading(false);
          onFirstSliceLoaded?.();
          layer.removeStateChangeCallback(onFirstLoad);
        }
      };
      layer?.addStateChangeCallback(onFirstLoad);
      if (shouldSetLayer) {
        setImageLayer(layer);
      }
    };
    createImageLayer();

    return () => {
      layer?.close();
      shouldSetLayer = false;
      setImageLayer(null);
    };
  }, [
    region,
    source,
    seriesDimensionName,
    onLayerCreated,
    onFirstSliceLoaded,
    zoomToFit,
  ]);

  useEffect(() => {
    const setZRangeFromData = async () => {
      if (!source.source) return;
      const loader = await source.source.open();
      const attributes = await loader.loadAttributes();
      // TODO: this only supports "full" range and expects the series dimension to be Z
      const zAxisIndex = attributes.dimensionNames.findIndex(
        (dim) => dim === seriesDimensionName
      );
      const min = 0;
      const max = attributes.shape[zAxisIndex] - 1;
      const omeroDefaultZ = await loadOmeroDefaultZ(source.url);
      setZValue(omeroDefaultZ / (max - min));
      setZRange([min, max]);
    };
    setZRangeFromData();
  }, [source, seriesDimensionName]);

  useEffect(() => {
    if (imageLayer) {
      const newLayerManager = new LayerManager();
      newLayerManager.add(imageLayer);
      setLayerManager(newLayerManager);
    }
  }, [imageLayer]);

  const zIndex = Math.round(zValue * (zRange[1] - zRange[0]) + zRange[0]);

  useEffect(() => {
    if (!imageLayer) return;
    let didSetLoadingTrue = false;
    const setIndex = async () => {
      const t = setTimeout(() => {
        setLoading(true);
        didSetLoadingTrue = true;
      }, 50);
      try {
        await imageLayer.setIndex(zIndex);
      } catch {
        console.debug("Load slice aborted - likely selected new condition");
        return;
      } finally {
        clearTimeout(t);
        if (didSetLoadingTrue) {
          setLoading(false);
        }
      }
    };
    setIndex();
  }, [imageLayer, zIndex]);

  const resetChannelsCallback = useCallback(async () => {
    const omeroChannels = await loadOmeroChannels(source.url);
    const channelProps = omeroToChannelProps(omeroChannels);
    imageLayer?.setChannelProps(channelProps);
    setControlProps(omeroToControlProps(omeroChannels));
  }, [source.url, imageLayer]);

  const loadAllSlicesCallback = useCallback(async () => {
    onLoadAllSlicesClicked?.();
    setLoading(true);
    try {
      await imageLayer?.preloadSeries();
    } catch {
      console.debug("Load 3D high-res aborted - likely selected new condition");
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

  return (
    <div
      className={cns(
        "w-full",
        "h-full",
        "flex",
        "flex-col",
        "flex-1",
        "gap-4",
        "min-h-0",
        "relative"
      )}
    >
      <Renderer
        layerManager={layerManager}
        camera={camera}
        cameraControls="panzoom"
      />
      {imageLayer && (
        <div
          className={cns(
            "absolute",
            "top-0",
            "left-0",
            "w-full",
            "md:!w-[400px]" // For some reason, this gets overwritten when compiled
            // so make it important
          )}
        >
          <ChannelControlsList
            layer={imageLayer}
            controlProps={controlProps}
            resetCallback={resetChannelsCallback}
          />
        </div>
      )}
      <div
        className={cns(
          "absolute",
          "bottom-0",
          "right-0",
          "w-full",
          "m-sds-l",
          "flex",
          "flex-col",
          "items-end"
        )}
      >
        <div
          className={cns(
            "flex",
            "justify-end",
            "items-center",
            "w-full",
            "h-6"
          )}
        >
          <div className={cns("flex", "justify-end", "w-1/3")}>
            {!loading && (
              <div
                // These share styles with ChannelControlsList
                className={cns(
                  "text-white",
                  "text-sm",
                  "bg-black/50",
                  "backdrop-blur-md",
                  "p-sds-xs",
                  "rounded-sds-m",
                  "shadow-sds-m",
                  "font-sds-code"
                )}
              >
                Slice {zIndex}/{zRange[1] - zRange[0]}
              </div>
            )}
            {loading && <LoadingIndicator sdsStyle="tag" />}
          </div>
        </div>
        {!allSlicesLoaded && (
          <Button
            sdsType="primary"
            sdsStyle="square"
            size="small"
            disabled={loading}
            onClick={loadAllSlicesCallback}
            className="mt-sds-l shadow-sds-m"
          >
            {props.allSlicesSizeEstimate
              ? `Load 3D high-res (${props.allSlicesSizeEstimate})`
              : "Load 3D high-res"}
          </Button>
        )}
        {allSlicesLoaded && (
          <div
            className={cns(
              // When using width 100%, the slider goes out of the
              // container, just undo it by subtracting the margin
              // of the container
              "w-[calc(100%-2*theme(spacing.sds-l))] md:w-[200px]",
              "flex",
              "justify-center",
              "items-center",
              "gap-2",
              "mt-sds-l",
              "bg-black/50",
              "backdrop-blur-md",
              "rounded-sds-m",
              "shadow-sds-m",
              "py-sds-xs",
              "px-sds-m"
            )}
          >
            <InputSlider
              min={0}
              max={1}
              step={1 / (zRange[1] - zRange[0])}
              value={zValue}
              className={cns(
                // Hardcode dark mode colors to force dark mode
                // look, no matter what the theme is
                // (Sharing styles with ContrastSlider component)
                "[&_.MuiSlider-rail]:!bg-[#494949]",
                "[&_.MuiSlider-mark]:!bg-[#696969]",
                "[&_.MuiSlider-valueLabelLabel]:!text-white",
                "[&_.MuiSlider-valueLabel]:!bg-[#0D7CB5]" // This is a biohub color,
                // not sure how I can take theme variables from the actual application
                // and use them here
              )}
              onChange={(_, value: number | number[]) => {
                if (typeof value === "number") {
                  setZValue(value);
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
