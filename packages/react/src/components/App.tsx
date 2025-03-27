import cns from "classnames";
import { Region } from "@idetik/core";
import { OmeZarrImageViewer } from "./viewers/OmeZarrImageViewer";

const sourceUrl =
  "https://public.czbiohub.org/organelle_box/datasets/A549/organelle_box_crop_v1.zarr";
const wellPath = "GOLGA2/Live";
const imagePath = "000002";
const imageUrl = `${sourceUrl}/${wellPath}/${imagePath}`;
const region: Region = [
  { dimension: "T", index: { type: "point", value: 0 } },
  { dimension: "C", index: { type: "full" } },
  { dimension: "Z", index: { type: "full" } },
  { dimension: "Y", index: { type: "full" } },
  { dimension: "X", index: { type: "full" } },
];

export default function App() {
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
          scale={-2}
          seriesDimensionName="Z"
        />
      </div>
    </div>
  );
}
