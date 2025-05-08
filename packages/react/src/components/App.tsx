import { Region } from "@idetik/core";
import { OmeZarrImageViewer } from "./viewers/OmeZarrImageViewer";
import { useCallback, useRef, useState } from "react";
import { ChannelControlsList } from "./viewers/OmeZarrImageViewer/components/ChannelControlsList";

const sourceUrl =
  "https://public.czbiohub.org/organelle_box/datasets/A549/organelle_box_crop_v1.zarr";
const wellPath = "ATG101/MeOH";
const region: Region = [
  { dimension: "T", index: { type: "point", value: 0 } },
  { dimension: "C", index: { type: "full" } },
  { dimension: "Z", index: { type: "full" } },
  { dimension: "Y", index: { type: "full" } },
  { dimension: "X", index: { type: "full" } },
];

const imagePaths = ["000000", "000001", "000002", "001000", "001001", "001002"];

/** Demo. */
export default function App() {
  const [imageIndex, setImageIndex] = useState(0);

  const imagePath = imagePaths[imageIndex];
  const imageUrl = `${sourceUrl}/${wellPath}/${imagePath}`;

  const layerCreatedTime = useRef<number | undefined>(undefined);
  const loadAllSlicesClickedTime = useRef<number | undefined>(undefined);

  const handleLayerCreated = useCallback(() => {
    layerCreatedTime.current = performance.now();
    console.log(`Layer created at ${layerCreatedTime.current}`);
  }, []);

  const handleFirstSliceLoaded = useCallback(() => {
    if (layerCreatedTime.current !== undefined) {
      const time = performance.now() - layerCreatedTime.current;
      console.log(`First slice loaded after ${time} ms`);
    } else {
      console.log("First slice loaded, but layer created time is undefined");
    }
  }, []);

  const handleLoadAllSlicesClicked = useCallback(() => {
    loadAllSlicesClickedTime.current = performance.now();
    console.log(
      `Load all slices clicked at ${loadAllSlicesClickedTime.current}`
    );
  }, []);

  const handleAllSlicesLoaded = useCallback(() => {
    if (loadAllSlicesClickedTime.current !== undefined) {
      const time = performance.now() - loadAllSlicesClickedTime.current;
      console.log(`All slices loaded after ${time} ms`);
    } else {
      console.log(
        "All slices loaded, but load all slices clicked time is undefined"
      );
    }
  }, []);

  const handleLoadAllSlicesAborted = useCallback(() => {
    if (loadAllSlicesClickedTime.current !== undefined) {
      const time = performance.now() - loadAllSlicesClickedTime.current;
      console.log(`Load all slices aborted after ${time} ms`);
    } else {
      console.log(
        "Load all slices aborted, but load all slices clicked time is undefined"
      );
    }
  }, []);

  return (
    <div className="h-screen flex flex-col">
      <OmeZarrImageViewer
        sourceUrl={imageUrl}
        region={region}
        seriesDimensionName="Z"
        allSlicesSizeEstimate="250 MB"
        classNames={{
          root: "bg-dark-sds-color-primitive-gray-100",
        }}
        onLayerCreated={handleLayerCreated}
        onFirstSliceLoaded={handleFirstSliceLoaded}
        onLoadAllSlicesClicked={handleLoadAllSlicesClicked}
        onAllSlicesLoaded={handleAllSlicesLoaded}
        onLoadAllSlicesAborted={handleLoadAllSlicesAborted}
      />
      <ChannelControlsList
        classNames={{ root: "absolute top-0 left-0 w-full md:!w-[400px]" }}
      />
      <input
        type="button"
        value="Switch Image"
        onClick={() => setImageIndex((imageIndex + 1) % imagePaths.length)}
        className="h-12"
      />
    </div>
  );
}
