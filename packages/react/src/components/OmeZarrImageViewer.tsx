import { useEffect, useState } from "react";
import cns from "classnames";
import CircularProgress from "@mui/material/CircularProgress";
import {
  ImageLayer,
  ImageStackLayer,
  LayerManager,
  OmeroChannel,
  OmeZarrImageSource,
  OrthographicCamera,
  Region,
  loadOmeroChannels,
  ChannelProps,
} from "@idetik/core";

import Renderer from "./Renderer";
import { ChannelControlsList } from "./controls/ChannelControlsList";
import { ChannelControlProps } from "./controls/ChannelControl";
import { ZControl } from "./controls/ZControl";
import { hexToRgb } from "lib/color";

interface OmeZarrImageViewerProps {
  sourceUrl: string;
  region: Region;
  scale?: number;
  zDimension?: string;
}

export default function OmeZarrImageViewer({
  sourceUrl,
  region,
  scale,
  zDimension,
}: OmeZarrImageViewerProps) {
  const [layerManager, _setLayerManager] = useState<LayerManager>(
    new LayerManager()
  );
  const [camera, _setCamera] = useState<OrthographicCamera>(
    new OrthographicCamera(0, 128, 0, 128)
  );
  const [imageLayer, setImageLayer] = useState<
    ImageLayer | ImageStackLayer | null
  >(null);
  const [source, setSource] = useState<OmeZarrImageSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [controlProps, setControlProps] = useState<
    Partial<ChannelControlProps>[]
  >([]);
  const [zRange, setZRange] = useState<[number, number]>([0, 0]);
  const [zFrac, setZFrac] = useState<number>(0);
  const [firstLoad, setFirstLoad] = useState(true);

  useEffect(() => {
    const newSource = new OmeZarrImageSource(sourceUrl, scale);
    setSource(newSource);
    setFirstLoad(true);
  }, [sourceUrl, scale, region, zDimension]);

  useEffect(() => {
    setLoading(true);
    const getLayer = async () => {
      if (!source) return;
      // TODO: don't reset when updating scale
      const omeroChannels = await loadOmeroChannels(sourceUrl);
      const channelProps = omeroToChannelProps(omeroChannels);
      setControlProps(omeroToControlProps(omeroChannels));
      let layer: ImageLayer | ImageStackLayer;
      if (zDimension === undefined) {
        layer = new ImageLayer({ source, region, channelProps });
        layer.addStateChangeCallback(() => {
          if (layer.state === "ready" && layer.extent !== undefined) {
            camera.setFrame(0, layer.extent.x, 0, layer.extent.y);
            camera.update();
          }
        });
      } else {
        layer = new ImageStackLayer({
          source,
          region,
          zDimension,
          channelProps,
        });
      }
      const setZRangeFromSource = async () => {
        const loader = await source.open();
        const attributes = await loader.loadAttributes();
        const zAxisIndex = attributes.dimensions.findIndex(
          (dim) => dim === zDimension
        );
        setZRange([0, attributes.shape[zAxisIndex] - 1]);
      };

      if (firstLoad) {
        layer.addStateChangeCallback(() => {
          if (layer.state === "loading" && layer.extent !== undefined) {
            camera.setFrame(0, layer.extent.x, 0, layer.extent.y);
            camera.update();
            setZRangeFromSource();
            setImageLayer(layer);
          }
          if (layer.state === "ready") {
            // when the low-res is done loading, update the source to fetch the high-res
            const newSource = new OmeZarrImageSource(sourceUrl, 0);
            setFirstLoad(false);
            setSource(newSource);
          }
        });
        // start loading the low-res data
        layer.update();
      } else {
        layer.addStateChangeCallback(() => {
          if (layer.state === "ready") {
            setLoading(false);
            setZRangeFromSource();
            setImageLayer(layer);
          }
        });
        // start loading the high-res data
        layer.update();
      }
    };
    getLayer();
  }, [firstLoad, source, sourceUrl, region, camera, zDimension]);

  useEffect(() => {
    if (imageLayer) {
      layerManager.layers.length = 0;
      layerManager.add(imageLayer);
    }
  }, [imageLayer, layerManager]);

  useEffect(() => {
    const zIndex = Math.round(zRange[0] + zFrac * (zRange[1] - zRange[0]));
    if (zDimension && imageLayer && imageLayer.state === "ready") {
      (imageLayer as ImageStackLayer).setZIndex(zIndex);
    }
  }, [zFrac, zRange, zDimension, imageLayer]);

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
      {zDimension && (
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
          <ZControl onChange={setZFrac} disabled={imageLayer === null} />
        </div>
      )}
    </div>
  );
}

// TODO: the limits/range from the omero channels should possibly be reversed
// (start/end for limits, min/max for range) but the organelle box data works better this way
// TODO: provide a way to get our own limits automatically from the data instead of the metadata
const omeroToChannelProps = (omeroChannels: OmeroChannel[]): ChannelProps[] => {
  return omeroChannels.map((channel: OmeroChannel) => {
    const { start, end, min, max } = channel.window;
    return {
      visible: channel.active,
      color: hexToRgb(channel.color),
      contrastLimits: [Math.max(start, min), Math.min(end, max)],
    };
  });
};

const omeroToControlProps = (
  omeroChannels: OmeroChannel[]
): Partial<ChannelControlProps>[] => {
  return omeroChannels.map((channel: OmeroChannel, index: number) => {
    // remove prefix (number + hyphen) from label if present (seen in organelle box data)
    const label = (channel.label ?? `Ch${index}`).replace(/^\d+-/, "");
    const { start, end, min, max } = channel.window;
    return {
      label,
      color: hexToRgb(channel.color),
      contrastLimits: [Math.max(start, min), Math.min(end, max)],
      contrastRange: [0.5 * start, 1.1 * end],
      visible: channel.active,
    };
  });
};
