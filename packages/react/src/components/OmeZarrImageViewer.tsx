import { useEffect, useState } from "react";
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
  const [camera, _setCamera] = useState<OrthographicCamera>(new OrthographicCamera(0, 832, 0, 351));
  const [imageLayer, setImageLayer] = useState<ImageLayer | null>(null);
  const [source, setSource] = useState<OmeZarrImageSource | null>(null);

  useEffect(() => {
    const source = new OmeZarrImageSource(sourceUrl);
    setSource(source);
  }, [sourceUrl]);

  useEffect(() => {
    const getLayer = async () => {
      if (!source) return;
      const loader = await source?.open();
      // TODO: should getting channel properties from the source go in the library?
      const channelProps = loader?.metadata.omero?.channels.map((channel: OmeroChannel) => {
        return {
          color: hexToRgb(channel.color),
          contrastLimits: [channel.window.start, channel.window.end],
        };
      }) ?? [];
      const layer = new ImageLayer({ source, region, channelProps });
      layer.addStateChangeCallback(() => {
        if (layer.state === "ready") {
          console.log("ImageLayer is ready", layer.extent);
          camera.setFrame(0, layer.extent.x, 0, layer.extent.y);
          camera.updateProjectionMatrix();
        }
      });

      setImageLayer(layer);
    };
    getLayer();
  }, [source, region, camera]);

  useEffect(() => {
    if (imageLayer) {
      // TODO: do we really want to clear any old layers?
      // TODO: dispose objects owned by old layers
      layerManager.layers.length = 0;
      layerManager.add(imageLayer);
    }
  }, [imageLayer, layerManager]);

  return (
    <Renderer
      layerManager={layerManager}
      camera={camera}
      enableControls={true}
    />
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
