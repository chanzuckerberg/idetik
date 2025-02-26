import cns from "classnames";
import OmeZarrImageViewer from "./OmeZarrImageViewer";

const plateUrl =
  "http://localhost:8080/20200812-CardiomyocyteDifferentiation14-Cycle1_mip.zarr";
const imageUrl = plateUrl + "/B/03/0";
const region = [{ dimension: "z", index: 0 }];

export default function App() {
  return (
    <div
      className={cns(
        "h-screen",
        "flex",
        "flex-row",
        "gap-4",
        "box-border",
        "p-4"
      )}
    >
      <div
        className={cns(
          "w-full",
          "h-full",
          "flex",
          "flex-col",
          "flex-1",
          "gap-4",
        )}
      >
        <OmeZarrImageViewer sourceUrl={imageUrl} region={region} />
      </div>
    </div>
  );
}
