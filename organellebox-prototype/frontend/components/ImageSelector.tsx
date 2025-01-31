import { Dropdown } from "@czi-sds/components";
import { Box } from "@mui/material";
import { Dispatch, SetStateAction } from "react";

type ImageSelectorProps = {
  images: string[];
  image: string;
  setImage: Dispatch<SetStateAction<string>>;
  wells: string[];
  well: string;
  setWell: Dispatch<SetStateAction<string>>;
};

export default function ImageSelector({
  images,
  image,
  setImage,
  wells,
  well,
  setWell,
}: ImageSelectorProps) {
  const wellOptions = wells.map((w) => ({ name: w }));
  const imageOptions = images.map((i) => ({ name: i }));
  return (
    <Box>
      <Dropdown
        label={`Well: ${well}`}
        options={wellOptions}
        multiple={false}
        onChange={(_, value) => {
          if (value === null) return;
          if (typeof value === "object") value = value.name;
          setWell(value);
        }}
      />
      <Dropdown
        label={`Image: ${image}`}
        options={imageOptions}
        multiple={false}
        onChange={(_, value) => {
          if (value === null) return;
          if (typeof value === "object") value = value.name;
          setImage(value);
        }}
      />
    </Box>
  );
}
