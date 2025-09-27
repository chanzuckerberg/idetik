import { InputSlider } from "@czi-sds/components";
import { ChunkedImageLayer, ChunkLoader } from "@idetik/core-prerelease";
import { OmeZarrChunkedImageViewer } from "../../src";
import { useCallback, useRef, useState } from "react";

const sourceUrl =
  "https://czii-onsite.czbiohub.org/krios1.processing/aretomo3/25jul30a/run002/vol003/Position_1_Vol.zarr";
const initZCoord = 296;

const fallbackContrastLimits: [number, number] = [-0.0008789, 0.0052775];

const viewerClassNames = {
  root: "bg-dark-sds-color-primitive-gray-100 flex-auto min-h-0",
};

function ChunkedImageViewerDemo() {
  const [zCoord, setZCoord] = useState<number>(initZCoord);
  const [zSliderConfig, setZSliderConfig] = useState<
    | {
        min: number;
        max: number;
        step: number;
        scale: number;
        translation: number;
      }
    | undefined
  >(undefined);

  const layerCreatedTime = useRef<number | undefined>(undefined);

  const handleLayerCreated = useCallback(
    (layer: ChunkedImageLayer) => {
      console.debug("layer", layer);
      layerCreatedTime.current = performance.now();

      // Update z-slider configuration based on loaded metadata
      layer.source
        .open()
        .then((loader: ChunkLoader) => {
          // Use LOD 0 (highest resolution) as reference for slider bounds
          const zLod0 = loader.getSourceDimensionMap().z?.lods[0];
          if (zLod0) {
            const actualZSliceCount = zLod0.size;
            setZSliderConfig({
              min: 0,
              max: actualZSliceCount - 1, // Last slice index (0-indexed)
              step: 1,
              scale: zLod0.scale,
              translation: zLod0.translation,
            });
          }
        })
        .catch((error: unknown) => {
          console.error("Failed to load z-dimension metadata:", error);
        });
    },
    [setZSliderConfig]
  );

  const handleFirstSliceLoaded = useCallback(() => {
    if (layerCreatedTime.current !== undefined) {
      const time = performance.now() - layerCreatedTime.current;
      console.log(`First slice loaded after ${time} ms`);
    } else {
      console.log("First slice loaded, but layer created time is undefined");
    }
  }, []);

  const handleZSliceChange = useCallback(
    (_event: Event, newZ: number | number[]) => {
      if (!zSliderConfig) return;
      if (typeof newZ !== "number") return;
      if (isNaN(newZ)) return;
      // Convert slider index to physical coordinate
      const physicalZ = zSliderConfig
        ? zSliderConfig.translation + newZ * zSliderConfig.scale
        : newZ; // Fallback to direct value if no metadata yet
      setZCoord(physicalZ);
    },
    [zSliderConfig, setZCoord]
  );

  return (
    <div className="h-screen flex flex-col">
      <OmeZarrChunkedImageViewer
        sourceUrl={sourceUrl}
        initZCoord={initZCoord}
        zCoord={zCoord}
        fallbackContrastLimits={fallbackContrastLimits}
        classNames={viewerClassNames}
        onLayerCreated={handleLayerCreated}
        onFirstSliceLoaded={handleFirstSliceLoaded}
      />
      <div className="flex h-16 shrink-0 bg-dark-sds-color-primitive-gray-200 p-4 items-center gap-4">
        <label className="text-white font-semibold min-w-fit">
          Z-Slice Navigation:
        </label>
        <InputSlider
          disabled={!zSliderConfig}
          value={
            zSliderConfig
              ? Math.round(
                  (zCoord - zSliderConfig.translation) / zSliderConfig.scale
                )
              : zCoord
          }
          min={zSliderConfig?.min}
          max={zSliderConfig?.max}
          step={zSliderConfig?.step}
          onChange={handleZSliceChange}
          className="flex-1"
        />
        <span className="text-white min-w-fit">
          {zSliderConfig
            ? `Slice ${zCoord} of ${zSliderConfig?.max}`
            : "Loading..."}
        </span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="h-screen flex flex-col">
      <ChunkedImageViewerDemo />
    </div>
  );
}
