import { useEffect, useState } from "react";
import cns from "classnames";
import CircularProgress from "@mui/material/CircularProgress";
import { InputSlider } from "@czi-sds/components";
import {
  ImageLayer,
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
  scale?: number;
  seriesDimensionName?: string;
}

export function OmeZarrImageViewer({
  sourceUrl,
  region,
  scale,
  seriesDimensionName,
}: OmeZarrImageViewerProps) {
  const [layerManager, _setLayerManager] = useState<LayerManager>(
    new LayerManager()
  );
  const [camera, _setCamera] = useState<OrthographicCamera>(
    new OrthographicCamera(0, 128, 0, 128)
  );
  const [imageLayer, setImageLayer] = useState<
    ImageLayer | ImageSeriesLayer | null
  >(null);
  const [source, setSource] = useState<OmeZarrImageSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [controlProps, setControlProps] = useState<
    Partial<ChannelControlProps>[]
  >([]);
  const [zRange, setZRange] = useState<[number, number]>([0, 0]);

  useEffect(() => {
    const source = new OmeZarrImageSource(sourceUrl, scale);
    setSource(source);
  }, [sourceUrl, scale]);

  useEffect(() => {
    setLoading(true);
    const getLayer = async () => {
      if (!source) return;
      // TODO: may need to accept channel properties to be possibly overridden here
      // (i.e. for initial visibility, custom colors)
      const omeroChannels = await loadOmeroChannels(sourceUrl);
      const channelProps = omeroToChannelProps(omeroChannels);
      setControlProps(omeroToControlProps(omeroChannels));
      let layer;
      if (seriesDimensionName === undefined) {
        layer = new ImageLayer({ source, region, channelProps });
      } else {
        layer = new ImageSeriesLayer({
          source,
          region,
          seriesDimensionName,
          channelProps,
        });
        layer.preloadSeries({ initialIndex: 0 });
      }
      layer.addStateChangeCallback(() => {
        if (layer.state === "ready") {
          setLoading(false);
          if (layer.extent !== undefined) {
            camera.setFrame(0, layer.extent.x, 0, layer.extent.y);
            camera.update();
          }
        }
      });
      setImageLayer(layer);
    };
    getLayer();
  }, [source, sourceUrl, region, camera, seriesDimensionName]);

  useEffect(() => {
    if (imageLayer) {
      layerManager.layers.length = 0;
      layerManager.add(imageLayer);
    }
  }, [imageLayer, layerManager]);

  useEffect(() => {
    if (seriesDimensionName !== undefined && source !== null) {
      const setZRangeFromData = async () => {
        const loader = await source.open();
        const attributes = await loader.loadAttributes();
        const zAxisIndex = attributes.dimensions.findIndex(
          (dim) => dim === seriesDimensionName
        );
        setZRange([0, attributes.shape[zAxisIndex] - 1]);
      };
      setZRangeFromData();
    }
  }, [source, seriesDimensionName]);

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
      {loading && (
        <div className={cns("absolute", "top-1/2", "left-1/2")}>
          <CircularProgress />
        </div>
      )}
      {imageLayer && (
        <div className={cns("absolute", "top-0", "left-0", "w-1/2")}>
          <ChannelControlsList layer={imageLayer} controlProps={controlProps} />
        </div>
      )}
      {seriesDimensionName && (
        <div
          className={cns(
            "absolute",
            "bottom-0",
            "right-3",
            "w-1/2",
            "px-5",
            "py-3"
          )}
        >
          <InputSlider
            min={zRange[0]}
            max={zRange[1]}
            onChange={(_, slice: number | number[]) => {
              if (
                imageLayer instanceof ImageSeriesLayer &&
                typeof slice === "number"
              ) {
                imageLayer.setIndex(slice);
              }
            }}
            disabled={loading}
          />
        </div>
      )}
    </div>
  );
}
