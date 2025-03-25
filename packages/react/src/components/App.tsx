import cns from "classnames";
import OmeZarrImageViewer from "./OmeZarrImageViewer";
import { Region } from "@idetik/core";

const plateUrl =
  // "http://localhost:8080/20200812-CardiomyocyteDifferentiation14-Cycle1_mip.zarr";
  // "http://localhost:8000";
  "https://public.czbiohub.org/organelle_box/datasets/A549/organelle_box_crop_v1.zarr";
// const imageUrl = plateUrl + "/B/03/0";
const imageUrl = plateUrl + "/GOLGA2/Live/000002";
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
          zDimension="Z"
        />
      </div>
    </div>
  );
}
