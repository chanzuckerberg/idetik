import OmeZarrImageViewer from "./OmeZarrImageViewer";
import { useState } from "react";
import { Box, Input } from '@mui/material';

import { HcsSelectors } from "./HcsSelectors";

const DEFAULT_URL =
  // "http://localhost:8000/";
  "http://localhost:8080/20200812-CardiomyocyteDifferentiation14-Cycle1_mip.zarr";
// const imageUrl = plateUrl + "/B/03/0";
const region = [
  // organelle box data has a T dimension and uses capital letters for the axis names
  // { dimension: "T", index: 0 },
  // { dimension: "Z", index: 0 },
  { dimension: "z", index: 0 },
];

export default function App() {
  const [url, setUrl] = useState<string>(DEFAULT_URL);
  const [imagePath, setImagePath] = useState<string | null>(null);

  console.log("url", url);
  console.log("imagePath", imagePath);

  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        gap: "1em",
        boxSizing: "border-box",
        padding: "1em",
      }}
    >
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <HcsSelectors url={url} setImagePath={setImagePath} />
      {
        imagePath ?
        <OmeZarrImageViewer
          sourceUrl={`${url}/${imagePath}`}
          region={region}
        /> : <Box>No image selected</Box>
      }
    </Box>
  );
}
