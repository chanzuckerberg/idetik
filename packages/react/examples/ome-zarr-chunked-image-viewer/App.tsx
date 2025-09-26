import { ThemeProvider as EmotionThemeProvider } from "@emotion/react";
import { StyledEngineProvider, ThemeProvider } from "@mui/material/styles";
import { Theme, InputSlider } from "@czi-sds/components";
import CssBaseline from "@mui/material/CssBaseline";
import useMediaQuery from "@mui/material/useMediaQuery";
import {
  SliceCoordinates,
  ChunkedImageLayer,
  ChunkLoader,
} from "@idetik/core-prerelease";
import { IdetikProvider, OmeZarrChunkedImageViewer } from "../../src";
import { useCallback, useRef, useState } from "react";

const sourceUrl =
  "https://czii-onsite.czbiohub.org/krios1.processing/aretomo3/25jul30a/run002/vol003/Position_1_Vol.zarr";
const initialSliceCoordinates: SliceCoordinates = {
  t: 0,
  z: 296,
};

const fallbackContrastLimits: [number, number] = [-0.0008789, 0.0052775];

const viewerClassNames = {
  root: "bg-dark-sds-color-primitive-gray-100 flex-auto min-h-0",
};

function ChunkedImageViewerDemo() {
  const [sliceCoordinates, setSliceCoordinates] = useState<SliceCoordinates>(
    initialSliceCoordinates
  );
  const updateZSliceRef = useRef<((zValue: number) => void) | null>(null);
  const [zSliderConfig, setZSliderConfig] = useState<{
    min: number;
    max: number;
    step: number;
    scale: number;
    translation: number;
    hasMetadata: boolean;
  }>({
    min: 0,
    max: 591,
    step: 1,
    scale: 1,
    translation: 0,
    hasMetadata: false,
  }); // Default values, will be updated when metadata is loaded

  const layerCreatedTime = useRef<number | undefined>(undefined);

  console.log("Rendering App with sourceUrl:", sourceUrl);
  const handleLayerCreated = useCallback(
    (layer?: ChunkedImageLayer, updateZSlice?: (zValue: number) => void) => {
      layerCreatedTime.current = performance.now();
      updateZSliceRef.current = updateZSlice || null;

      // Update z-slider configuration based on loaded metadata
      if (layer?.source) {
        layer.source
          .open()
          .then((loader: ChunkLoader) => {
            const dimensionMap = loader.getSourceDimensionMap();
            const zDimension = dimensionMap.z;

            if (zDimension && zDimension.lods.length > 0) {
              // Use LOD 0 (highest resolution) as reference for slider bounds
              const zLod0 = zDimension.lods[0];
              const actualZSliceCount = zLod0.size;

              setZSliderConfig({
                min: 0,
                max: actualZSliceCount - 1, // Last slice index (0-indexed)
                step: 1,
                scale: zLod0.scale,
                translation: zLod0.translation,
                hasMetadata: true,
              });
            }
          })
          .catch((error: unknown) => {
            console.error("Failed to load z-dimension metadata:", error);
          });
      }
    },
    []
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
      const sliderValue = Array.isArray(newZ) ? newZ[0] : newZ;
      if (typeof sliderValue === "number" && !isNaN(sliderValue)) {
        // Convert slider index to physical coordinate
        const physicalZ = zSliderConfig.hasMetadata
          ? zSliderConfig.translation + sliderValue * zSliderConfig.scale
          : sliderValue; // Fallback to direct value if no metadata yet

        setSliceCoordinates((prev: SliceCoordinates) => ({
          ...prev,
          z: physicalZ,
        }));
        if (updateZSliceRef.current) {
          updateZSliceRef.current(physicalZ);
        }
      }
    },
    [zSliderConfig]
  );

  return (
    <div className="h-screen flex flex-col">
      <OmeZarrChunkedImageViewer
        sourceUrl={sourceUrl}
        sliceCoordinates={sliceCoordinates}
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
          value={
            zSliderConfig.hasMetadata && sliceCoordinates.z !== undefined
              ? Math.round(
                  (sliceCoordinates.z - zSliderConfig.translation) /
                    zSliderConfig.scale
                )
              : (sliceCoordinates.z ?? zSliderConfig.min)
          }
          min={zSliderConfig.min}
          max={zSliderConfig.max}
          step={zSliderConfig.step}
          onChange={handleZSliceChange}
          className="flex-1"
        />
        <span className="text-white min-w-fit">
          Slice {sliceCoordinates.z ?? zSliderConfig.min} of {zSliderConfig.max}
        </span>
      </div>
    </div>
  );
}

export default function App() {
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const theme = prefersDarkMode ? Theme("dark") : Theme("light");

  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <EmotionThemeProvider theme={theme}>
          <CssBaseline />
          <IdetikProvider>
            <ChunkedImageViewerDemo />
          </IdetikProvider>
        </EmotionThemeProvider>
      </ThemeProvider>
    </StyledEngineProvider>
  );
}
