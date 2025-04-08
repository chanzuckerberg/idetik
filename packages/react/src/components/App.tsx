import cns from "classnames";
import { Region } from "@idetik/core";
import { OmeZarrImageViewer } from "./viewers/OmeZarrImageViewer";
import { useState } from "react";

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

export default function App() {
  const [imageIndex, setImageIndex] = useState(0);

  const imagePath = imagePaths[imageIndex];
  const imageUrl = `${sourceUrl}/${wellPath}/${imagePath}`;
  return (
    <div className={cns("h-screen", "flex", "flex-row", "gap-4", "p-4")}>
      <div
        className={cns(
          "w-full",
          "h-full",
          "flex",
          "flex-col",
          "flex-1",
          "gap-4"
        )}
      >
        <OmeZarrImageViewer
          sourceUrl={imageUrl}
          region={region}
          seriesDimensionName="Z"
          highResSizeEstimate="200 MB"
          onFirstSliceLoaded={(msTimeToLoad) => {
            console.log(`First slice loaded in ${msTimeToLoad} ms`);
          }}
          onAllSlicesLoaded={(msTimeToLoad) => {
            console.log(`All slices loaded in ${msTimeToLoad} ms`);
          }}
        />
      </div>
      <input
        type="button"
        value="Switch Image"
        onClick={() => setImageIndex((imageIndex + 1) % imagePaths.length)}
      />
    </div>
  );
}
