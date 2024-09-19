import { Box } from "@mui/material";
import {
  LayerManager,
  ImageLayer,
  OmeZarrImageSource,
} from "@";
import Renderer from "./Renderer";
import PlaybackControls from "./PlaybackControls";
import { useEffect, useState } from "react";

// Source is 5D, so provide indices at 3 dimensions to project to 2D.
const url =
    "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/";
const source = new OmeZarrImageSource(url);
const region = [
    // TODO: when the region is state associated with the renderer or
    // layer manager, and we have a reference to that, then sync it
    // with React state that captures the time-point.
    { dimension: "t", index: 400 },
    { dimension: "c", index: 0 },
    { dimension: "z", index: 300 },
];
const layer = new ImageLayer(source, region);
const layerManager = new LayerManager();
layerManager.add(layer);

const playbackFPS = 16;
const playbackIntervalMs = 1000 / playbackFPS;

export default function App() {
  // TODO: this state should be kept in sync with the corresponding
  // state in the visualization library. For now, use known values
  // associated with the data we are using here.
  const [curTime, setCurTime] = useState<number>(0);
  const [numTimes, _] = useState<number>(791);

  const [playing, setPlaying] = useState<boolean>(false);

  useEffect(() => {
    console.debug("effect-playback: ", curTime, playing);
    if (playing) {
      const interval = setInterval(
        () => {setCurTime((curTime + 1) % numTimes)},
        playbackIntervalMs,
      );
      return () => {
        clearInterval(interval);
      };
    }
  }, [numTimes, curTime, playing]);

  return (
    <Box sx={{
      display: "flex",
      flexDirection: "column",
      gap: "1em",
    }}>
      <Renderer
        layerManager={layerManager}
      ></Renderer>
      <PlaybackControls
        playing={playing}
        curTime={curTime}
        numTimes={numTimes}
        setPlaying={setPlaying}
        setCurTime={setCurTime}
      ></PlaybackControls>
    </Box>
  );
}
