import { InputSlider } from "@czi-sds/components";
import { OmeZarrChunkedImageViewer } from "../../src";
import { useCallback, useRef, useState } from "react";

const sourceUrl =
  "https://czii-onsite.czbiohub.org/krios1.processing/aretomo3/25jul30a/run002/vol003/Position_1_Vol.zarr";
const initZIndex = 296;

const fallbackContrastLimits: [number, number] = [-0.0008789, 0.0052775];

const viewerClassNames = {
  root: "bg-dark-sds-color-primitive-gray-100 flex-auto min-h-0",
};

function ChunkedImageViewerDemo() {
  const [zIndex, setZIndex] = useState<number>(initZIndex);
  const [zMaxIndex, setZMaxIndex] = useState<number | undefined>(undefined);

  const layerCreatedTime = useRef<number | undefined>(undefined);

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
      if (typeof newZ !== "number") return;
      if (isNaN(newZ)) return;
      setZIndex(newZ);
    },
    [setZIndex]
  );

  return (
    <div className="h-screen flex flex-col">
      <OmeZarrChunkedImageViewer
        sourceUrl={sourceUrl}
        initZIndex={initZIndex}
        zIndex={zIndex}
        setZMaxIndex={setZMaxIndex}
        fallbackContrastLimits={fallbackContrastLimits}
        classNames={viewerClassNames}
        onFirstSliceLoaded={handleFirstSliceLoaded}
      />
      <div className="flex h-16 shrink-0 bg-dark-sds-color-primitive-gray-200 p-4 items-center gap-4">
        <label className="text-white font-semibold min-w-fit">
          Z-Slice Navigation:
        </label>
        <InputSlider
          disabled={zMaxIndex === undefined}
          value={zIndex}
          min={0}
          max={zMaxIndex}
          onChange={handleZSliceChange}
          className="flex-1"
        />
        <span className="text-white min-w-fit">
          {zMaxIndex !== undefined
            ? `Slice ${zIndex} of ${zMaxIndex}`
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
