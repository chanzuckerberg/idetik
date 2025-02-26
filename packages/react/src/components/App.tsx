import { Box } from "@mui/system";
import OmeZarrImageViewer from "./OmeZarrImageViewer";

const plateUrl =
  "http://localhost:8080/20200812-CardiomyocyteDifferentiation14-Cycle1_mip.zarr";
const imageUrl = plateUrl + "/B/03/0";
const region = [
  { dimension: "z", index: 0 },
];

export default function App() {

  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        flexDirection: "row",
        gap: "1em",
        boxSizing: "border-box",
        padding: "1em",
      }}
    >
      <Box
        sx={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          flex: 1,
          gap: "1em",
          border: "1px solid black",
        }}
      >
        <OmeZarrImageViewer
          sourceUrl={imageUrl}
          region={region}
        />
      </Box>
    </Box>
  );
}
