import { useEffect, useState } from "react";
import { Box } from "@mui/system";
import CircularProgress from '@mui/material/CircularProgress';
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
}

export default function OmeZarrImageViewer({
  sourceUrl,
  region,
}: OmeZarrImageViewerProps) {
  const [layerManager, _setLayerManager] = useState<LayerManager>(new LayerManager());
  const [camera, _setCamera] = useState<OrthographicCamera>(new OrthographicCamera(0, 128, 0, 128));
  const [imageLayer, setImageLayer] = useState<ImageLayer | null>(null);
  const [source, setSource] = useState<OmeZarrImageSource | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const source = new OmeZarrImageSource(sourceUrl);
    setSource(source);
  }, [sourceUrl]);

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
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        flex: 1,
        gap: "1em",
        border: "1px solid black",
      }}
    >
      <Renderer
        layerManager={layerManager}
        camera={camera}
        cameraControls="panzoom"
      />
      {
        loading &&
        <Box sx={{ position: "fixed", top: "50%", left: "50%" }}>
          <CircularProgress />
        </Box>
      }
      {
        imageLayer &&
        <Box sx={{ position: "fixed", top: "3em", left: "3em", width: "25em" }}>
          <ChannelControlsList layer={imageLayer} />
        </Box>
      }
    </Box>
  );
}
