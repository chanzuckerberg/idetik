import { Box } from "@mui/material";
import { Dispatch, SetStateAction } from "react";
import ImageSelector from "./ImageSelector";
import Channel, { ChannelProps } from "./Channel";

type ControlsProps = {
  images: string[];
  image: string;
  setImage: Dispatch<SetStateAction<string>>;
  wells: string[];
  well: string;
  setWell: Dispatch<SetStateAction<string>>;
  channels: ChannelProps[];
  setChannels: Dispatch<SetStateAction<ChannelProps[]>>;
};

export default function Controls({
  images,
  image,
  setImage,
  wells,
  well,
  setWell,
  channels,
  setChannels,
}: ControlsProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: "1em",
        width: 200,
      }}
    >
      <ImageSelector
        images={images}
        image={image}
        setImage={setImage}
        wells={wells}
        well={well}
        setWell={setWell}
      />
      {channels.map((channel, i) => (
        <Channel
          key={i}
          {...channel}
          onChange={(c) => setChannels(channels.with(i, c))}
        />
      ))}
    </Box>
  );
}
