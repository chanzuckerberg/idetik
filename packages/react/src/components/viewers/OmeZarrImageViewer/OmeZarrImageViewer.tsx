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
} from "@idetik/core";

import { Renderer } from "./components/Renderer";
import { ChannelControlsList } from "./components/ChannelControlsList";
import { ChannelControlProps } from "./components/ChannelControlsList/components/ChannelControl";
import { omeroToChannelProps, omeroToControlProps } from "./utils";

interface OmeZarrImageViewerProps {
  sourceUrl: string;
  region: Region;
  seriesDimensionName: string;
  initialScale?: number;
  loadHighResButton?: boolean;
  highResSizeEstimate?: string;
}

// consolidated state to prevent effects from firing multiple times
interface SourceState {
  source: OmeZarrImageSource | null;
  url: string;
  isHighRes: boolean;
}

export function OmeZarrImageViewer({
  sourceUrl,
  region,
  seriesDimensionName,
  initialScale,
  loadHighResButton,
  highResSizeEstimate,
}: OmeZarrImageViewerProps) {
  const [layerManager, _setLayerManager] = useState<LayerManager>(
    new LayerManager()
  );
  const [camera, _setCamera] = useState<OrthographicCamera>(
    new OrthographicCamera(0, 128, 0, 128)
  );
  const [source, setSource] = useState<SourceState>({
    source: null,
    url: sourceUrl,
    isHighRes: initialScale === 0 || !loadHighResButton,
  });
  const [loading, setLoading] = useState(true);
  const [imageLayer, setImageLayer] = useState<ImageSeriesLayer | null>(null);

  const [controlProps, setControlProps] = useState<
    Partial<ChannelControlProps>[]
  >([]);
  const [zRange, setZRange] = useState<[number, number]>([0, 0]);
  const [zValue, setZValue] = useState(0.5);

  // set a new source whenever *any* prop changes to force reload
  useEffect(() => {
    const source = new OmeZarrImageSource(sourceUrl, initialScale);
    setSource({
      source,
      url: sourceUrl,
      isHighRes: initialScale === 0 || !loadHighResButton,
    });
  }, [
    sourceUrl,
    region,
    seriesDimensionName,
    initialScale,
    loadHighResButton,
    highResSizeEstimate,
  ]);

  const isFirstLoad =
    !loadHighResButton || initialScale === 0 || !source.isHighRes;

  useEffect(() => {
    let shouldSetLayer = true;
    let layer: ImageSeriesLayer | null = null;
    const setZRangeFromData = async () => {
      if (!source.source) return;
      const loader = await source.source.open();
      const attributes = await loader.loadAttributes();
      const zAxisIndex = attributes.dimensionNames.findIndex(
        (dim) => dim === seriesDimensionName
      );
      const min = 0;
      const max = attributes.shape[zAxisIndex] - 1;
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
      if (isFirstLoad) {
        setImageLayer(layer);
        layer.preloadSeries();
        await setZRangeFromData();
        const setCamera = () => {
          if (layer?.extent !== undefined) {
            setLoading(false);
            camera.setFrame(0, layer.extent.x, 0, layer.extent.y);
            camera.update();
            layer.removeStateChangeCallback(setCamera);
          }
        };
        layer.addStateChangeCallback(setCamera);
      } else {
        await layer.preloadSeries();
        if (!shouldSetLayer) {
          return;
        }
        await setZRangeFromData();
        setLoading(false);
        setImageLayer(layer);
      }
    };
    getLayer();

    return () => {
      layer?.close();
      shouldSetLayer = false;
    };
  }, [isFirstLoad, source, region, camera, seriesDimensionName]);

  useEffect(() => {
    if (imageLayer) {
      layerManager.layers.length = 0;
      layerManager.add(imageLayer);
    }
  }, [imageLayer, layerManager]);

  const zIndex = Math.round(zValue * (zRange[1] - zRange[0]) + zRange[0]);
  useEffect(() => {
    imageLayer?.setIndex(zIndex);
  }, [zIndex, imageLayer]);

  const resetChannelsCallback = useCallback(async () => {
    const omeroChannels = await loadOmeroChannels(source.url);
    const channelProps = omeroToChannelProps(omeroChannels);
    imageLayer?.setChannelProps(channelProps);
    setControlProps(omeroToControlProps(omeroChannels));
  }, [source.url, imageLayer]);

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
        <div className={cns("absolute", "top-0", "left-0", "w-1/2")}>
          <ChannelControlsList
            layer={imageLayer}
            controlProps={controlProps}
            reset={isFirstLoad}
            resetCallback={resetChannelsCallback}
          />
        </div>
      )}
      {loading && (
        <div className={cns("absolute", "bottom-0", "left-3", "px-5", "py-3")}>
          <LoadingIndicator sdsStyle="tag" />
        </div>
      )}
      {!loading && !source.isHighRes && (
        <div className={cns("absolute", "bottom-0", "left-3", "px-5", "py-3")}>
          <Button
            sdsType="primary"
            sdsStyle="rounded"
            onClick={() => {
              const newSource = new OmeZarrImageSource(sourceUrl, 0);
              setSource({ source: newSource, url: sourceUrl, isHighRes: true });
            }}
          >
            {highResSizeEstimate
              ? `Load high res (${highResSizeEstimate})`
              : "Load high res"}
          </Button>
        </div>
      )}
      <div
        className={cns(
          "absolute",
          "bottom-0",
          "right-0",
          "w-1/2",
          "px-5",
          "py-3",
          "before:absolute",
          "before:left-0",
          "before:top-0",
          "before:w-full",
          "before:h-full",
          "before:bg-[--sds-color-semantic-base-background-primary]",
          "before:opacity-35",
          "before:content-['']",
          "flex",
          "items-center"
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
          disabled={loading && !source.isHighRes}
        />
      </div>
    </div>
  );
}
