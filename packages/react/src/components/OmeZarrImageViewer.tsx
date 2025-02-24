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
  }, [source, region, camera, setLoading]);

  useEffect(() => {
    if (imageLayer) {
      // TODO: do we really want to clear the layer list? we only have one layer anyway...
      // TODO: dispose objects owned by old layers
      layerManager.layers.length = 0;
      layerManager.add(imageLayer);
    }
  }, [imageLayer, layerManager]);
  console.log("loading", loading);

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
        <Box sx={{ position: "absolute", top: "50%", left: "50%" }}>
          <CircularProgress />
        </Box>
      }
    </Box>
  );
}

// TODO: taken from Phoenix's code, should be consolidated
const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ];
};
