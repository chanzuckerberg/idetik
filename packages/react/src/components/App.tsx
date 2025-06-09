import {
  Color,
  ImageSeriesLayer,
  OmeZarrImageSource,
  OmeroChannel,
  Region,
  loadOmeroChannels,
  loadOmeroDefaultZ,
  OrthographicCamera,
} from "@idetik/core";
import { useIdetik } from "./hooks/useIdetik";
import { IdetikCanvas } from "./IdetikCanvas";
import { IdetikLayerList } from "./IdetikLayerList";
import { HcsImagePanel } from "./HcsImagePanel";
import { useState, useEffect, useRef } from "react";
import { ChannelControlsList } from "./viewers/OmeZarrImageViewer/components/ChannelControlsList";

interface AppProps {
  baseUrl?: string;
}

interface HcsMetadata {
  imageUrl: string;
  omeroChannels: OmeroChannel[];
  defaultZ: number;
}

/** Demonstration app for Idetik with HCS image support */
export default function App({
  baseUrl = "https://public.czbiohub.org/organelle_box/datasets/A549/organelle_box_crop_v1.zarr",
}: AppProps) {
  const {
    isReady: runtimeIsReady,
    // activeLayers,
    methods,
    runtime,
  } = useIdetik();

  const [well, setWell] = useState<string>("ACTB/PFA");
  const [fov, setFov] = useState<string>("001002");
  const [hcsMetadata, setHcsMetadata] = useState<HcsMetadata | null>(null);
  const imageLayerRef = useRef<ImageSeriesLayer | null>(null);

  // Load HCS metadata when well/fov changes
  useEffect(() => {
    if (!well || !fov) {
      setHcsMetadata(null);
      return;
    }

    const loadMetadata = async () => {
      try {
        const imageUrl = `${baseUrl}/${well}/${fov}`;
        const omeroChannels = await loadOmeroChannels(imageUrl);
        const defaultZ = await loadOmeroDefaultZ(imageUrl);
        setHcsMetadata({ imageUrl, omeroChannels, defaultZ });
      } catch (error) {
        console.error("Failed to load HCS metadata:", error);
        setHcsMetadata(null);
      }
    };

    loadMetadata();
  }, [baseUrl, well, fov]);

  // Manage image layer lifecycle with cleanup
  useEffect(() => {
    if (!runtimeIsReady || !hcsMetadata || imageLayerRef.current) {
      return;
    }

    const source = new OmeZarrImageSource(hcsMetadata.imageUrl);
    const region: Region = [
      { dimension: "T", index: { type: "point", value: 0 } },
      { dimension: "C", index: { type: "full" } },
      { dimension: "Z", index: { type: "full" } },
      { dimension: "Y", index: { type: "full" } },
      { dimension: "X", index: { type: "full" } },
    ];

    const newLayer = new ImageSeriesLayer({
      source,
      region,
      seriesDimensionName: "Z",
      channelProps: hcsMetadata.omeroChannels.map((channel) => ({
        visible: channel.active,
        color: Color.fromRgbHex(channel.color),
        contrastLimits: [channel.window.min, channel.window.max],
      })),
    });
    methods.addLayer(newLayer);
    imageLayerRef.current = newLayer;
    newLayer.setIndex(0).then(() => {
      if (imageLayerRef.current !== newLayer) {
        return;
      }
      const { x, y } = newLayer.extent!;
      const camera = runtime.camera as OrthographicCamera;
      camera?.setFrame(0, x, y, 0);
    });

    return () => {
      if (imageLayerRef.current === newLayer) {
        if (methods?.isLayerActive(newLayer)) {
          methods.removeLayer(newLayer);
        }
        imageLayerRef.current = null;
      }
    };
  }, [runtimeIsReady, methods, runtime, hcsMetadata]);

  return (
    <div className="h-screen flex">
      <div className="flex-1">
        <IdetikCanvas />
        {imageLayerRef.current && (
          <ChannelControlsList
            layer={imageLayerRef.current}
            labels={
              hcsMetadata?.omeroChannels.map((c) => c.label || "FIXME") ?? []
            }
            contrastRanges={
              hcsMetadata?.omeroChannels.map((c) => [
                c.window.start,
                c.window.end,
              ]) ?? []
            }
            classNames={{ root: "absolute top-0 left-0 z-10" }}
          />
        )}
      </div>

      <div className="w-64 p-4 bg-gray-100 flex flex-col gap-4">
        <HcsImagePanel
          baseUrl={baseUrl}
          well={well}
          fov={fov}
          onWellChange={setWell}
          onFovChange={setFov}
        />
        <IdetikLayerList />
      </div>
    </div>
  );
}
