// Source is 5D, so provide indices at 3 dimensions to project to 2D.
export const videoLayerTimeInterval = { start: 100, stop: 150 };
export const videoLayerProps = {
    url: "https://public.czbiohub.org/royerlab/ultrack/multi-color/image.zarr/",
    region: [
      { dimension: "T", index: videoLayerTimeInterval },
      { dimension: "C", index: 0 },
      { dimension: "Z", index: 0 },
    ],
    timeDimension: "T",
}
