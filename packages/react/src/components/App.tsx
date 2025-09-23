import { SliceCoordinates, ChunkedImageLayer } from "@idetik/core-prerelease";
import { OmeZarrChunkedImageViewer } from "./viewers/OmeZarrChunkedImageViewer";
import { useCallback, useRef, useState } from "react";
import { InputSlider } from "@czi-sds/components";

const sourceUrl =
  "https://czii-onsite.czbiohub.org/krios1.processing/aretomo3/25jul30a/run002/vol003/Position_1_Vol.zarr";
const initialSliceCoordinates: SliceCoordinates = {
  t: 0,
  z: 296,
};

/** Demo. */
export default function App() {
  const [sliceCoordinates, setSliceCoordinates] = useState<SliceCoordinates>(initialSliceCoordinates);
  const updateZSliceRef = useRef<((zValue: number) => void) | null>(null);
  const zMax = 591; // 0-indexed max for 592 slices

  const layerCreatedTime = useRef<number | undefined>(undefined);

  console.log("Rendering App with sourceUrl:", sourceUrl);
  const handleLayerCreated = useCallback((layer: ChunkedImageLayer, updateZSlice?: (zValue: number) => void) => {
    layerCreatedTime.current = performance.now();
    console.log(`Layer created at ${layerCreatedTime.current}`);
    console.log("Layer:", layer, "updateZSlice function:", updateZSlice);
    updateZSliceRef.current = updateZSlice || null;
  }, []);

  const handleFirstSliceLoaded = useCallback(() => {
    if (layerCreatedTime.current !== undefined) {
      const time = performance.now() - layerCreatedTime.current;
      console.log(`First slice loaded after ${time} ms`);
    } else {
      console.log("First slice loaded, but layer created time is undefined");
    }
  }, []);

  const handleZSliceChange = useCallback((_, newZ: number | number[]) => {
    const zValue = Array.isArray(newZ) ? newZ[0] : newZ;
    if (typeof zValue === 'number' && !isNaN(zValue)) {
      setSliceCoordinates((prev: SliceCoordinates) => ({ ...prev, z: zValue }));
      if (updateZSliceRef.current) {
        updateZSliceRef.current(zValue);
      }
    }
  }, []);

  return (
    <div className="h-screen flex flex-col">
      <OmeZarrChunkedImageViewer
        sourceUrl={sourceUrl}
        sliceCoordinates={sliceCoordinates}
        fallbackContrastLimits={[-0.0008789, 0.0052775]}
        classNames={{
          root: "bg-dark-sds-color-primitive-gray-100 flex-auto min-h-0",
        }}
        onLayerCreated={handleLayerCreated}
        onFirstSliceLoaded={handleFirstSliceLoaded}
      />
      <div className="h-16 shrink-0 bg-dark-sds-color-primitive-gray-200 p-4 flex items-center gap-4">
        <label className="text-white font-semibold min-w-fit">Z-Slice Navigation:</label>
        <InputSlider
          value={sliceCoordinates.z ?? 0}
          min={0}
          max={zMax}
          step={1}
          onChange={handleZSliceChange}
          className="flex-1"
        />
        <span className="text-white min-w-fit">
          Slice {sliceCoordinates.z ?? 0} of {zMax}
        </span>
      </div>
    </div>
  );
}
