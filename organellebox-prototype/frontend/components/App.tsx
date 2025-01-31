import { Box } from "@mui/system";
import Renderer from "./Renderer";
import Controls from "./Controls";
import { useEffect, useState } from "react";

import {
  loadOmeZarrPlate,
  loadOmeZarrWell,
} from "@/data/ome_zarr_hcs_metadata_loader";

export default function App() {
  const [plateUrl, _] = useState(
    "http://localhost:8080/20200812-CardiomyocyteDifferentiation14-Cycle1_mip.zarr"
  );
  // TODO: empty and disabled initially.
  const [wells, setWells] = useState(["B/03", "B/05"]);
  const [well, setWell] = useState("B/03");
  const [images, setImages] = useState(["0"]);
  const [image, setImage] = useState("0");

  useEffect(() => {
    const fetchPlate = async () => {
      const plate = await loadOmeZarrPlate(plateUrl);
      console.debug("plate", plate);
      const wellPaths = plate.plate?.wells.map((well) => well.path);
      if (wellPaths === undefined || wellPaths.length === 0) {
        throw new Error(`No wells found: ${wellPaths}`);
      }
      setWells(wellPaths);
      setWell(wellPaths[0]);

      const well = await loadOmeZarrWell(plateUrl, wellPaths[0]);
      const imagePaths = well.well?.images.map((image) => image.path);
      if (imagePaths === undefined || imagePaths.length === 0) {
        throw new Error(`No images found: ${imagePaths}`);
      }
      setImages(imagePaths);
      setImage(imagePaths[0]);
    };
    fetchPlate();
  }, [plateUrl]);

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
          display: "flex",
          flex: 0,
        }}
      >
        <Controls
          images={images}
          image={image}
          setImage={setImage}
          wells={wells}
          well={well}
          setWell={setWell}
        />
      </Box>
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
        <Renderer imageUrl={`${plateUrl}/${well}/${image}`} />
      </Box>
    </Box>
  );
}
