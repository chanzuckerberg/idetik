import { useEffect, useState } from "react";
import cns from "classnames";
import CircularProgress from "@mui/material/CircularProgress";
import {
  ImageLayer,
  LayerManager,
  OmeroChannel,
  OmeZarrImageSource,
  OrthographicCamera,
  Region,
  loadOmeroChannels,
  ChannelProps,
} from "@idetik/core";

import { Renderer } from "components/Renderer";
import { ChannelControlsList } from "components/controls/ChannelControlsList";
import { ChannelControlProps } from "components/controls/ChannelControl";
import { hexToRgb } from "lib/color";

interface OmeZarrImageViewerProps {
  sourceUrl: string;
  region: Region;
  scale?: number;
}

export default function OmeZarrImageViewer({
  sourceUrl,
  region,
  scale,
}: OmeZarrImageViewerProps) {
  const [layerManager, _setLayerManager] = useState<LayerManager>(
    new LayerManager()
  );
  const [camera, _setCamera] = useState<OrthographicCamera>(
    new OrthographicCamera(0, 128, 0, 128)
  );
  const [imageLayer, setImageLayer] = useState<ImageLayer | null>(null);
  const [source, setSource] = useState<OmeZarrImageSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [controlProps, setControlProps] = useState<
    Partial<ChannelControlProps>[]
  >([]);

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
      const layer = new ImageLayer({ source, region, channelProps });
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
  }, [source, sourceUrl, region, camera]);

  useEffect(() => {
    if (imageLayer) {
      layerManager.layers.length = 0;
      layerManager.add(imageLayer);
    }
  }, [imageLayer, layerManager]);

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
        <div className={cns("absolute", "top-0", "left-0", "w-[25em]")}>
          <ChannelControlsList layer={imageLayer} controlProps={controlProps} />
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
    return {
      label,
      contrastRange: [0.5 * channel.window.start, 1.1 * channel.window.end],
    };
  });
};
