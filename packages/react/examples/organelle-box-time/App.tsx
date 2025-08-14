import { Region } from "@idetik/core";
import { OmeZarrImageViewer } from "../../src/components/viewers/OmeZarrImageViewer";
import { useState } from "react";

const sourceUrl =
  "https://public.czbiohub.org/organelle_box/datasets/A549/2024_11_07_A549_SEC61_DENV_cropped.zarr";
const wellPath = "B/3";
const region: Region = [
  { dimension: "T", index: { type: "full" } },
  { dimension: "C", index: { type: "full" } },
  { dimension: "Z", index: { type: "point", value: 0 } },
  { dimension: "Y", index: { type: "full" } },
  { dimension: "X", index: { type: "full" } },
];

const imagePaths = ["000000", "000001", "000002", "001000", "001001", "001002"];

/** Organelle Box time use case demo. */
export default function App() {
  const [imageIndex, setImageIndex] = useState(0);

  const imagePath = imagePaths[imageIndex];
  const imageUrl = `${sourceUrl}/${wellPath}/${imagePath}`;

  return (
    <div className="h-screen flex flex-col">
      <OmeZarrImageViewer
        sourceUrl={imageUrl}
        region={region}
        seriesDimensionName="T"
        initialIndex="start"
        loadAllButtonText="Load entire duration (230MB)"
        classNames={{
          root: "bg-dark-sds-color-primitive-gray-100 flex-auto min-h-0",
        }}
        indexIndicatorText={(currentIndex, totalIndexes) =>
          `${Math.floor(currentIndex / 60)}m${currentIndex % 60}s of ${Math.floor(totalIndexes / 60)}m${totalIndexes % 60}s`
        }
      />
      <input
        type="button"
        value="Next Image"
        onClick={() => setImageIndex((imageIndex + 1) % imagePaths.length)}
        className="h-12 shrink-0 basis-[50px]"
      />
    </div>
  );
}
