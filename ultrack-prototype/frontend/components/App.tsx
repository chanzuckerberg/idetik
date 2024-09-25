import { Box } from "@mui/material";
import Renderer from "./Renderer";
import PlaybackControls from "./PlaybackControls";

export default function App() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: "1em",
      }}
    >
      <Renderer></Renderer>
      <PlaybackControls></PlaybackControls>
    </Box>
  );
}
