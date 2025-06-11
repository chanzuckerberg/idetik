import { Region } from "@idetik/core";
import { OmeZarrImageViewer } from "../../src/components/viewers/OmeZarrImageViewer";
import { useState } from "react";
import { ChannelControlsList } from "../../src/components/viewers/OmeZarrImageViewer/components/ChannelControlsList";

const sourceUrl =
  "https://public.czbiohub.org/organelle_box/datasets/A549/2024_11_07_A549_SEC61_DENV_cropped.zarr";
const wellPath = "B/3";
const region: Region = [
  { dimension: "T", index: { type: "point", value: 0 } },
  { dimension: "C", index: { type: "full" } },
  { dimension: "Z", index: { type: "full" } },
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
        seriesDimensionName="Z"
        allSlicesSizeEstimate="250 MB"
        classNames={{
          root: "bg-dark-sds-color-primitive-gray-100 flex-auto min-h-0",
        }}
        formatIndexIndicator={(currentIndex, totalIndexes) =>
          `Time ${currentIndex} of ${totalIndexes}`
        }
      />
      <div className="absolute top-0 left-0 w-full md:!w-[400px]">
        <ChannelControlsList />
      </div>
      <input
        type="button"
        value="Next Image"
        onClick={() => setImageIndex((imageIndex + 1) % imagePaths.length)}
        className="h-12 shrink-0 basis-[50px]"
      />
    </div>
  );
}
