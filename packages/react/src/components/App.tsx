import { Box } from "@mui/system";
import Renderer from "./Renderer";
import { ChannelControlsList } from "./controls/ChannelControlsList";
import { useState } from "react";
import { ImageLayer } from "@idetik/core";

export default function App() {
  const [imageLayer, setImageLayer] = useState<ImageLayer | null>(null);

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
        }}
      >
        <Renderer onLayerReady={setImageLayer} />
      </Box>
      <Box sx={{ width: 300 }}>
        {imageLayer && <ChannelControlsList layer={imageLayer} />}
      </Box>
    </Box>
  );
}
