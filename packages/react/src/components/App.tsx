import cns from "classnames";
import { OmeZarrImageViewer } from "./viewers/OmeZarrImageViewer";

const plateUrl =
  "https://public.czbiohub.org/organelle_box/datasets/A549/organelle_box_crop_v1.zarr";
const imageUrl = plateUrl + "/GOLGA2/Live/000000";
// const plateUrl = "http://localhost:8080/20200812-CardiomyocyteDifferentiation14-Cycle1_mip.zarr";
// const imageUrl = plateUrl + "/B/03/0";
const region = [
  { dimension: "T", index: 0 },
  { dimension: "Z", index: 0 },
  // { dimension: "z", index: 0 },
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
        <OmeZarrImageViewer sourceUrl={imageUrl} region={region} />
      </div>
    </div>
  );
}
