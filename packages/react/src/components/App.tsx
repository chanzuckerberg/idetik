import {
  Color,
  ProjectedLineLayer,
  ImageSeriesLayer,
  OmeZarrImageSource,
  OmeroChannel,
  Region,
  loadOmeroChannels,
  loadOmeroDefaultZ,
  OrthographicCamera,
} from "@idetik/core";
import { Button } from "@czi-sds/components";
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

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~137.50776405003785 degrees

/** Demo. */
export default function App({
  baseUrl = "https://public.czbiohub.org/organelle_box/datasets/A549/organelle_box_crop_v1.zarr",
}: AppProps) {
  const {
    isReady: runtimeIsReady,
    activeLayers,
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

  const createLayer = () => {
    if (!runtimeIsReady) {
      console.error("Context value is not available");
      return;
    }
    const basePath = [
      [-100, 0, 0],
      [100, 0, 0],
    ];
    const angle = activeLayers.length * GOLDEN_ANGLE;
    const path: [number, number, number][] = basePath.map((point) => {
      const x = point[0] * Math.cos(angle) - point[1] * Math.sin(angle);
      const y = point[0] * Math.sin(angle) + point[1] * Math.cos(angle);
      return [x, y, point[2]];
    });
    // set color based on angle, cycling through the hue spectrum
    const hue = (angle / (2 * Math.PI)) % 1; // Normalize angle to [0, 1]
    const saturation = 1.0; // Fixed saturation
    const lightness = 0.5; // Fixed lightness
    // convert HSL to RGB (fixed saturation and lightness)
    const color: [number, number, number] = hslToRgb(
      hue,
      saturation,
      lightness
    );
    const layer = new ProjectedLineLayer([
      {
        path,
        color,
        width: 0.01,
      },
    ]);
    methods.addLayer(layer);
  };

  return (
    <div className="h-screen flex">
      <div className="flex-1">
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
        <IdetikCanvas />
      </div>
      <div className="w-64 p-4 bg-gray-100 flex flex-col gap-4">
        <HcsImagePanel
          baseUrl={baseUrl}
          well={well}
          fov={fov}
          onWellChange={setWell}
          onFovChange={setFov}
        />

        <Button sdsStyle="minimal" onClick={createLayer}>
          Add Line Layer
        </Button>

        <IdetikLayerList />
      </div>
    </div>
  );
}

const hslToRgb = (
  hue: number,
  saturation: number,
  lightness: number
): [number, number, number] => {
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((hue * 6) % 2) - 1));
  const m = lightness - c / 2;

  let r: number, g: number, b: number;

  if (hue < 1 / 6) {
    [r, g, b] = [c, x, 0];
  } else if (hue < 2 / 6) {
    [r, g, b] = [x, c, 0];
  } else if (hue < 3 / 6) {
    [r, g, b] = [0, c, x];
  } else if (hue < 4 / 6) {
    [r, g, b] = [0, x, c];
  } else if (hue < 5 / 6) {
    [r, g, b] = [x, 0, c];
  } else {
    [r, g, b] = [c, 0, x];
  }

  return [r + m, g + m, b + m];
};
