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
} from "@idetik/core";

import Renderer from "./Renderer";
import { ChannelControlsList } from "./controls/ChannelControlsList";
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
      const channelProps = omeroChannels.map((channel: OmeroChannel) => {
        return {
          color: hexToRgb(channel.color),
          contrastLimits: [channel.window.start, channel.window.end],
          // TODO: also get channel label and contrast range here
        };
      });
      const layer = new ImageLayer({ source, region, channelProps });
      layer.addStateChangeCallback(() => {
        if (layer.state === "ready") {
          setLoading(false);
          camera.setFrame(0, layer.extent.x, 0, layer.extent.y);
          camera.update();
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
        <div className={cns("absolute", "top-4", "left-4", "w-[25em]")}>
          <ChannelControlsList layer={imageLayer} />
        </div>
      )}
    </div>
  );
}
