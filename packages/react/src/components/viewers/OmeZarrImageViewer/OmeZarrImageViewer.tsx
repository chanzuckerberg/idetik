import { useCallback, useEffect, useState } from "react";
import cns from "classnames";
import {
  Button,
  InputSlider,
  LoadingIndicator,
  Tag,
} from "@czi-sds/components";
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
  highResSizeEstimate?: string;
}

// consolidated state to prevent effects from firing multiple times
interface SourceState {
  source: OmeZarrImageSource | null;
  url: string;
}

export function OmeZarrImageViewer({
  sourceUrl,
  region,
  seriesDimensionName,
  highResSizeEstimate,
}: OmeZarrImageViewerProps) {
  const [layerManager, _setLayerManager] = useState<LayerManager>(
    new LayerManager()
  );
  const [camera, setCamera] = useState<OrthographicCamera | null>(null);
  const [source, setSource] = useState<SourceState>({
    source: null,
    url: sourceUrl,
  });
  const [loading, setLoading] = useState(true);
  const [allSlicesLoaded, setAllSlicesLoaded] = useState(false);
  const [imageLayer, setImageLayer] = useState<ImageSeriesLayer | null>(null);

  const [controlProps, setControlProps] = useState<
    Partial<ChannelControlProps>[]
  >([]);
  const [needChannelsReset, setNeedChannelsReset] = useState(false);

  const [zRange, setZRange] = useState<[number, number]>([0, 0]);
  const [zValue, setZValue] = useState(0.5);

  // set a new source whenever *any* prop changes to force reload
  useEffect(() => {
    // 0 is the highest resolution
    const source = new OmeZarrImageSource(sourceUrl, 0);
    setSource({
      source,
      url: sourceUrl,
    });
    setAllSlicesLoaded(false);
  }, [sourceUrl, region, seriesDimensionName, highResSizeEstimate]);

  useEffect(() => {
    let shouldSetLayer = true;
    let layer: ImageSeriesLayer | null = null;
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
    const getLayer = async () => {
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
      if (!shouldSetLayer) {
        return;
      }
      setImageLayer(layer);
      await setZRangeFromData();
      const zoomToFit = () => {
        if (layer?.extent !== undefined) {
          setLoading(false);
          const newCamera = new OrthographicCamera(
            0,
            layer.extent.x,
            0,
            layer.extent.y
          );
          setCamera(newCamera);
          layer.removeStateChangeCallback(zoomToFit);
        }
      };
      layer.addStateChangeCallback(zoomToFit);
    };
    getLayer();

    return () => {
      layer?.close();
      shouldSetLayer = false;
      setNeedChannelsReset(true);
      setImageLayer(null);
    };
  }, [source, region, seriesDimensionName]);

  useEffect(() => {
    if (imageLayer) {
      layerManager.layers.length = 0;
      layerManager.add(imageLayer);
      setNeedChannelsReset(false);
    }
  }, [imageLayer, layerManager]);

  const zIndex = Math.round(zValue * (zRange[1] - zRange[0]) + zRange[0]);

  useEffect(() => {
    if (!imageLayer) return;
    let didSetLoadingTrue = false;
    const setIndex = async () => {
      const t = setTimeout(() => {
        setLoading(true);
        didSetLoadingTrue = true;
      }, 50);
      await imageLayer.setIndex(zIndex);
      clearTimeout(t);
      if (didSetLoadingTrue) {
        setLoading(false);
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
    setLoading(true);
    try {
      await imageLayer?.preloadSeries();
    } catch {
      console.debug("Load 3D high-res aborted - likely selected new condition");
      return;
    } finally {
      setLoading(false);
    }
    setAllSlicesLoaded(true);
  }, [imageLayer]);

  return (
    <div
      className={cns(
        "w-full",
        "h-full",
        "flex",
        "flex-col",
        "flex-1",
        "gap-4",
        "border",
        "border-solid",
        "border-black",
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
        <div className={cns("absolute", "top-0", "left-0", "w-3/4")}>
          <ChannelControlsList
            layer={imageLayer}
            controlProps={controlProps}
            reset={needChannelsReset}
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
          "px-5",
          "py-3",
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
          {!allSlicesLoaded && (
            <Button
              sdsType="primary"
              sdsStyle="rounded"
              size="small"
              disabled={loading}
              onClick={loadAllSlicesCallback}
            >
              {highResSizeEstimate
                ? `Load 3D high-res (${highResSizeEstimate})`
                : "Load 3D high-res"}
            </Button>
          )}
          <div className={cns("flex", "justify-end", "w-1/3")}>
            {!loading && (
              // TODO: "tag" is not very semantic but this looks okay
              <Tag
                label={`slice ${zIndex}/${zRange[1] - zRange[0]}`}
                sdsStyle="square"
                sdsType="secondary"
                hover={false}
              />
            )}
            {loading && <LoadingIndicator sdsStyle="tag" />}
          </div>
        </div>
        {allSlicesLoaded && (
          <div
            className={cns(
              "w-2/3",
              "flex",
              "justify-center",
              "items-center",
              "gap-2"
            )}
          >
            <InputSlider
              min={0}
              max={1}
              step={1 / (zRange[1] - zRange[0])}
              value={zValue}
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
