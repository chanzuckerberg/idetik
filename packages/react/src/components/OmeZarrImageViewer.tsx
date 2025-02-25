import { useEffect, useState } from "react";
import { Box } from "@mui/system";
import CircularProgress from '@mui/material/CircularProgress';
import {
  ImageLayer,
  LayerManager,
  OmeNgffImage,
  OmeZarrImageSource,
  OrthographicCamera,
  Region,
} from "@idetik/core";

import Renderer from "./Renderer";
import { ChannelControlsList } from "./controls/ChannelControlsList";
import { hexToRgb } from "../lib/color";


type OmeroChannel = OmeNgffImage["omero"]["channels"][number];

export default function OmeZarrImageViewer({
  sourceUrl,
  region,
}: {
  sourceUrl: string;
  region: Region;
}) {
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
      const loader = await source?.open();
      // TODO: should getting channel properties from the source go in the library?
      // TODO: may need to accept channel properties to be possibly overridden here
      // (i.e. for initial visibility, custom colors)
      const channelProps = loader?.metadata.omero?.channels.map((channel: OmeroChannel) => {
        return {
          color: hexToRgb(channel.color),
          contrastLimits: [channel.window.start, channel.window.end],
        };
      }) ?? [];
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
  }, [source, region, camera]);

  useEffect(() => {
    if (imageLayer) {
      // TODO: do we really want to clear the layer list? we only have one layer anyway...
      // TODO: dispose objects owned by old layers
      layerManager.layers.length = 0;
      layerManager.add(imageLayer);
    }
  }, [imageLayer, layerManager]);

  return (
    <Box
      sx={{
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        flex: 1,
        gap: "1em",
        border: "1px solid black",
        position: "relative",
      }}
    >
      <Renderer
        layerManager={layerManager}
        camera={camera}
        cameraControls="panzoom"
      />
      {
        loading &&
        <Box sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
          <CircularProgress />
        </Box>
      }
      {
        imageLayer &&
        <Box sx={{ position: "absolute", top: "1em", left: "1em", width: "25em" }}>
          <ChannelControlsList layer={imageLayer} />
        </Box>
      }
    </Box>
  );
}
